// ###
var express     = require('express');
var bodyParser 	= require('body-parser');
var unirest		= require('unirest');
var com         = require('./communication');
// ## EXPRESS

var app = express();
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app._bot = {};

app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.set('CLOUDANT_KEY', 			process.env.CLOUDANT_KEY );
app.set('CLOUDANT_PASSWORD',		process.env.CLOUDANT_PASSWORD );
app.set('CLOUDANT_URL', 			process.env.CLOUDANT_URL );
app.set('FIDOR_OAUTH_CLIENT_ID',	process.env.FIDOR_OAUTH_CLIENT_ID );
app.set('FIDOR_OAUTH_CLIENT_SECRET',process.env.FIDOR_OAUTH_CLIENT_SECRET );
app.set('FIDOR_AUTH_URL', 			process.env.FIDOR_AUTH_URL );
app.set('FIDOR_API_URL', 			process.env.FIDOR_API_URL );
app.set('TELEGRAM_TOKEN', 			process.env.TELEGRAM_TOKEN );

app.set('STATE', 					Math.random() );

// ##############

app.get('/', function(request, response) {
	response.render('index');
});

app.get('/login', function(request, response) {
	console.log('LOGIN');
    
    var id        = request.query.id,
	    oauth_url = app.get('FIDOR_AUTH_URL') + '/authorize' +
					'?client_id=' + app.get('FIDOR_OAUTH_CLIENT_ID') +
					'&state=' + app.get('STATE') +
					'&response_type=code' +
					'&redirect_uri=' + encodeURIComponent( 'http://' + request.headers.host + '/oauth?cid='+id );
	console.log('Redirect ->', oauth_url);
	response.writeHead( 307, { 'location': oauth_url } );
	response.end();
});

app.get('/oauth', function(request, response) {
    console.log('OAUTH');

	var code	= request.query.code,
		id	    = request.query.cid;

	unirest.post( app.get('FIDOR_AUTH_URL') + '/token' )
		.auth( app.get('FIDOR_OAUTH_CLIENT_ID'), app.get('FIDOR_OAUTH_CLIENT_SECRET'), true )
		.send('code=' + code )
		.send('client_id=' + app.get('FIDOR_OAUTH_CLIENT_ID') )
		.send('redirect_uri=' + encodeURIComponent( "http://" + request.headers.host + "/oauth?cid=" + id ) )
		.send('grant_type=authorization_code')
		.end( function(oauth_response){
			oauth_response.body.issued = Math.round(Date.now() / 1000);    
            console.log( 'TOKEN ->', oauth_response.body );
            
            com.saveAccountInCouch({
                _id: id,
                token: oauth_response.body 
            }, function(){
                app._bot.onLoginSuccess(id);
            }.bind(this) );
			//request.session.token = JSON.stringify( oauth_response.body );
			response.writeHead( 307, { "location": "/close" } );
			response.end();
		});
});

app.get('/close', function(request, response) {
    return "It's save to close the window now...";
});

/*
app.get('/refresh', function(request, response) {
	var token = JSON.parse(request.session.token),
		rt = token.refresh_token;

	var r = unirest.post( app.get('FIDOR_AUTH_URL') + '/token' )
		.auth( app.get('FIDOR_OAUTH_CLIENT_ID'), app.get('FIDOR_OAUTH_CLIENT_SECRET'), true )
		.send('refresh_token=' + rt )
		.send('state=' +  app.get('STATE') )
		.send('grant_type=refresh_token')
		.end( function(oauth_response){
			console.log( 'Refreshed TOKEN ->', oauth_response.body );
			oauth_response.body.issued = Math.round(Date.now() / 1000);
			response.writeHead( 307, { 'location': '/account' } );
			response.end();
		});

});
*/
// ##############

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});

module.exports = function (bot){
    console.log("Webook?", bot.useWebhook);
    app._bot = bot;
    if(bot.useWebhook){
        app.use( bot.webHookCallback('/'+bot.token) );
    }
};

















/*

app.get('/account', function(request, response) {
	var token = checkSessionToken(request, response); //JSON.parse(request.session.token);
	var params = {
		_id: "",
		//group: (Math.random() * 5 | 0) + 1,
		token: token,
		user: null,
		account: null
	}

	unirest.get( app.get('FIDOR_API_URL') + 'accounts' )
		.header( 'Authorization', 'Bearer ' + token.access_token)
		.header( 'Accept', 'application/vnd.fidor.de; version=1,text/json')
		.end( function(r){
			console.log(r.body);
			if(r.body.code==401){
				response.writeHead( 307, { 'location': '/refresh' } );
				response.end();
			}else{
				var result = r.body[0];
				params._id = result.id;
				params.user = {
					name: result.customers[0].first_name,
					nick: result.customers[0].nick,
					last_update: result.customers[0].updated_at
				};
				params.account = {
					id: result.id,
					iban: result.iban,
					balance: result.balance,
					last_update: result.updated_at
				}
				
				saveAccountInCouch(params);
				
				response.render('account', { params: params });
			}
		} );
});

app.get('/delete/:id', function(request, response) {
	// TODO
	// replace :id with a more secure parameter... the id is quite easy to guess
	unirest.head( app.get('CLOUDANT_URL') + '/' + request.params.id )
		.auth( app.get('CLOUDANT_KEY'), app.get('CLOUDANT_PASSWORD'), true )
		.send()
		.end(function(couch_response){
			console.log(couch_response);
			if(couch_response.statusCode == 200){

				unirest.delete( app.get('CLOUDANT_URL') + '/' + request.params.id )
					.query( 'rev=' + JSON.parse(couch_response.headers.etag) )
					.auth( app.get('CLOUDANT_KEY'), app.get('CLOUDANT_PASSWORD'), true )
					.send()
					.end(function(couch_response){
						console.log(couch_response);
						request.session.token = "";
						response.writeHead( 307, { 'location': '/' } );
						response.end();
					});
			}
		});

});
*/
