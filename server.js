console.log = function(){
	console.warn( JSON.stringify(arguments) );
}

// ###
var express     = require('express');
var bodyParser 	= require('body-parser');
var session 	= require('cookie-session')
var unirest		= require('unirest');

var app         = express();

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use( session({
  	secret: process.env.COOKIE_SECRET,
  	encrypted: true
}) );

app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.set('CLOUDANT_KEY', 			process.env.CLOUDANT_KEY );
app.set('CLOUDANT_PASSWORD',		process.env.CLOUDANT_PASSWORD );
app.set('CLOUDANT_URL', 			process.env.CLOUDANT_URL );
app.set('FIDOR_OAUTH_CLIENT_ID',	process.env.FIDOR_OAUTH_CLIENT_ID );
app.set('FIDOR_OAUTH_CLIENT_SECRET',process.env.FIDOR_OAUTH_CLIENT_SECRET );
app.set('PUSHOVER_API_KEY', 		process.env.PUSHOVER_API_KEY );
app.set('SENDGRID_PASSWORD', 		process.env.SENDGRID_PASSWORD );
app.set('SENDGRID_USERNAME', 		process.env.SENDGRID_USERNAME );
app.set('FIDOR_AUTH_URL', 			process.env.FIDOR_AUTH_URL );
app.set('FIDOR_API_URL', 			process.env.FIDOR_API_URL );

app.set('STATE', 					Math.random() );

// ##############
function checkSessionToken(request, response){
	if( request.session.hasOwnProperty('token') ){
		console.log('Token', request.session.token);
		if( request.session.token.length > 0 ){ // token was set sometime in the past
			var token = JSON.parse(request.session.token),
				now = Math.round( Date.now() / 1000 ),
				expires = (token.issued + token.expires_in)
						
			if( now > expires ){ //check if token is expired
				// refresh token
				console.log('Expired token found...');
				response.writeHead( 307, { "location": '/refresh' } );
				response.end();
				return;
			}
			// allright return token as object
			console.log('Perfect token found...');
			return token;
		}

		console.log('Empty token found...');
	}

	// no token? send user to redirect to login with fidor...
	console.log('No token found...');
	request.session.token = "";
	response.writeHead( 307, { 'location': '/redirect' } );
	response.end();
	return;

}

function saveAccountInCouch(doc, callback){
	
	unirest.head( app.get('CLOUDANT_URL') + '/' + doc._id )
		.auth( app.get('CLOUDANT_KEY'), app.get('CLOUDANT_PASSWORD'), true )
		.send()
		.end(function(couch_response){
			if(couch_response.statusCode == 200){
				// update the doc with the proper _rev
				doc._rev = JSON.parse(couch_response.headers.etag);
			}
			// otherwise just create it...
			unirest.put( app.get('CLOUDANT_URL') + '/' + doc._id )
				.auth( app.get('CLOUDANT_KEY'), app.get('CLOUDANT_PASSWORD'), true )
				.type('json')
				.send(doc)
				.end( function(couch_response){
					console.log( 'PUT', couch_response );
				});
		});

}
// ##############

app.get('/', function(request, response) {
	response.render('index');
});

app.get('/redirect', function(request, response) {

	var oauth_url = app.get('FIDOR_AUTH_URL') + '/authorize' +
					'?client_id=' + app.get('FIDOR_OAUTH_CLIENT_ID') +
					'&state=' + app.get('STATE') +
					'&response_type=code' +
					'&redirect_uri=' + encodeURIComponent( 'http://' + request.headers.host + '/oauth?endpoint=/account' );
	console.log('Redirect ->', oauth_url);
	response.writeHead( 307, { 'location': oauth_url } );
	response.end();

});

app.get('/oauth', function(request, response) {
	var code	= request.query.code,
		target	= request.query.endpoint;

	request.session.code = code;

	unirest.post( app.get('FIDOR_AUTH_URL') + '/token' )
		.auth( app.get('FIDOR_OAUTH_CLIENT_ID'), app.get('FIDOR_OAUTH_CLIENT_SECRET'), true )
		.send('code=' + code )
		.send('client_id=' + app.get('FIDOR_OAUTH_CLIENT_ID') )
		.send('redirect_uri=' + encodeURIComponent( "http://" + request.headers.host + "/oauth?endpoint=" + target) )
		.send('grant_type=authorization_code')
		.end( function(oauth_response){
			console.log( 'TOKEN ->', oauth_response.body );
			oauth_response.body.issued = Math.round(Date.now() / 1000);
			request.session.token = JSON.stringify( oauth_response.body );
			response.writeHead( 307, { "location": target } );
			response.end();
		});

});


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
			request.session.token = JSON.stringify( oauth_response.body );
			response.writeHead( 307, { 'location': '/account' } );
			response.end();
		});

});

app.get('/account', function(request, response) {
	var token = checkSessionToken(request, response); //JSON.parse(request.session.token);
	var params = {
		_id: "",
		//group: (Math.random() * 5 | 0) + 1,
		token: token,
		user: null,
		account: null,
		notification: null
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
				params.notification = {
					email: {
						address: result.customers[0].email,
						active: false
					},
					pushover: {
						key: "",
						active: false
					}
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

// ##############

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});





