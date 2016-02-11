var express     = require('express');
var bodyParser 	= require('body-parser');
var OAuth 		= require('oauth');
var unirest		= require('unirest');
var app         = express();

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.set('port', (process.env.PORT || 3141));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

var config = {};
app.set('CLOUDANT_KEY', 			process.env.CLOUDANT_KEY );
app.set('CLOUDANT_PASSWORD',		process.env.CLOUDANT_PASSWORD );
app.set('CLOUDANT_URL', 			process.env.CLOUDANT_URL );
app.set('FIDOR_OAUTH_CLIENT_ID',	process.env.FIDOR_OAUTH_CLIENT_ID );
app.set('FIDOR_OAUTH_CLIENT_SECRET',process.env.FIDOR_OAUTH_CLIENT_SECRET );
app.set('PUSHOVER_API_KEY', 		process.env.PUSHOVER_API_KEY );
app.set('SENDGRID_PASSWORD', 		process.env.SENDGRID_PASSWORD );
app.set('SENDGRID_USERNAME', 		process.env.SENDGRID_USERNAME );

// ##############

app.get('/', function(request, response) {
	response.render('index');
});

app.get('/redirect', function(request, response) {
	var fidor_config = {
		fidor_api_url  : "https://aps.fidor.de/",
	  	fidor_oauth_url: "https://aps.fidor.de/oauth"
	}
    
    var oauth2 = new OAuth.OAuth2(
		app.get('FIDOR_OAUTH_CLIENT_ID'),
      	app.get('FIDOR_OAUTH_CLIENT_SECRET'),
      	fidor_config.fidor_api_url,
      	'oauth/',
      	'oauth/token',
      	null
    );
    
	console.log( oauth2 );
	console.log( JSON.stringify(oauth2, null, "    ") );
    
    
    oauth2.getOAuthAccessToken(
    	'',
      	{
	      	'grant_type':'client_credentials'
		},
      	function(e, access_token, refresh_token, results){
      		console.log('bearer: ',access_token);
    	}
    );
    
    
    
    
    return
    
    
    
    var redirect_uri = encodeURIComponent( request.headers.host + "/oauth?ep=/account" )
    var oauth_url = fidor_config.fidor_oauth_url +
  				  	"/authorize?client_id=" + app.get('FIDOR_OAUTH_CLIENT_ID') +
  				  	"&state=123&response_type=code&" +
  				  	"redirect_uri=" + redirect_uri;
  	console.log('OAuth Redirect to: ', oauth_url);
    response.writeHead(307, {"location" : oauth_url})
    response.end()
    return
});

app.get('/oauth', function(request, response) {
	console.log( JSON.stringify(request, null, '    ') );
	console.log('------------------------------')
	console.log( JSON.stringify(response, null, '    ') );
});

app.get('/account', function(request, response) {
	response.render('pages/index');
});

// ##############

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});















