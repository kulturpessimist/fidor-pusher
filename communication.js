var unirest		= require('unirest');
var numeral     = require('numeral');

var com = {
    checkSessionToken: function(id, callback){
        
        unirest.get( process.env.CLOUDANT_URL + '/' + id )
            .auth( process.env.CLOUDANT_KEY, process.env.CLOUDANT_PASSWORD, true )
            .end(function(response){
                var session = JSON.parse(response.body);
                console.log( 'checkSession', session );
                // now check the session data...
                if( session.hasOwnProperty('token') ){
                    console.log('Token', session.token);
                    if( session.token.access_token.length > 0 ){ // token was set sometime in the past
                        var now = Math.round( Date.now() / 1000 ),
                            expires = (session.token.issued + session.token.expires_in);
                            
                        if( now > expires ){ //check if token is expired
                            // refresh token
                            console.log('Expired token found...');
                            com.refeshToken(session, callback);
                        }else{
                            // allright return token as object
                            console.log('Perfect token found...');
                            callback(session);
                        }
                    }
	            }else{
                    // no token? send user to redirect to login with fidor...
                    console.log('No token found...');
                    
                }
            });
    },
    refeshToken: function(session, callback){
		console.log(session);

	    var r = unirest.post( process.env.FIDOR_AUTH_URL + '/token' )
		    .auth( process.env.FIDOR_OAUTH_CLIENT_ID, process.env.FIDOR_OAUTH_CLIENT_SECRET, true )
		    .send('refresh_token=' + session.token.refresh_token )
		    .send('state=' +  session.token.state )
		    .send('grant_type=refresh_token')
		    .end( function(oauth_response){
			    oauth_response.body.issued = Math.round(Date.now() / 1000);
			    var session = oauth_response.body;
                console.log( 'Refreshed TOKEN ->', session );
			    
                com.saveAccountInCouch({
                    _id: session._id,
                    token: session
                }, function(){
                    callback(session);
                }.bind(this) );
		    });
    },

    saveAccountInCouch: function(doc, callback){
	
        unirest.head( process.env.CLOUDANT_URL + '/' + doc._id )
            .auth( process.env.CLOUDANT_KEY, process.env.CLOUDANT_PASSWORD, true )
            .send()
            .end(function(couch_response){
                if(couch_response.statusCode == 200){
                    // update the doc with the proper _rev
                    doc._rev = JSON.parse(couch_response.headers.etag);
                }
                // otherwise just create it...
                unirest.put( process.env.CLOUDANT_URL + '/' + doc._id )
                    .auth( process.env.CLOUDANT_KEY, process.env.CLOUDANT_PASSWORD, true )
                    .type('json')
                    .send(doc)
                    .end( function(couch_response){
                        console.log( 'PUT SUCCESSFUL' );
                        callback();
                    });
            });
    },
    /*
        Communication with Fidor
    */
    getAccountBalance: function(id, callback){
    
        this.checkSessionToken(id, function(session){
            console.log('getAccountBalance', session);

            unirest.get( process.env.FIDOR_API_URL + 'accounts' )
                .header( 'Authorization', 'Bearer ' + session.access_token)
                .header( 'Accept', 'application/vnd.fidor.de; version=1,text/json')
                .end( function(r){
                    console.log(r.body.data);
                    var result = numeral(r.body.data[0].balance).format('0,0[.]00 €');
                    callback(result);
                });
        });
    }


}

module.exports = com;