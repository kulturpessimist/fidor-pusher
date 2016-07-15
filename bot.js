var Telegraf 	= require('telegraf');
var com 	    = require('./communication');

var bot         = new Telegraf( process.env.TELEGRAM_TOKEN );
var extra       = Telegraf.Extra;
var markup      = Telegraf.Extra.Markup;

if(process.env.NODE_ENV === 'production') {
    bot.useWebhook = true;
}else{
    bot.useWebhook = false;
    bot.startPolling();
}

// bot.use( Telegraf.memorySession() );

// keyboards
var logout = extra.HTML().markup(
                markup.inlineKeyboard([
                    { text: 'Logout? Really?', callback_data: 'Logout' }
                ]).resize().oneTime()
            );
var operation = extra.HTML().markup(
                    markup.keyboard([
                        { text: 'Show my account balance' },
                        { text: 'Show last transactions' },
                        { text: 'Logout' }
                    ]).resize().oneTime()
                );
var nullkeyboard = extra.HTML().markup(
                    markup.keyboard([]).hideKeyboard()
                ); 

// Start and interaction with human
// short introduction and keyboard with button to login with fidor
bot.hears('/start', function(ctx){
    return ctx.reply( "Hallo "+(ctx.from.first_name || ctx.from.username), nullkeyboard )
        .then(function(){
            return ctx.reply( "Ich bin der FidorBot. Ich schicke Dir bei jeder Kontobewegung eine Nachricht um dich auf dem laufenden zu halten.", nullkeyboard )
        })
        .then(function(){
            return ctx.reply( "Log dich hierzu einfach mit deinem Fidor Account ein und los geht's. Du kannst den Zugriff jederzeit wiederrufen.", extra.HTML().markup(
                markup.inlineKeyboard([
                    { text: 'Login', url: 'http://0.0.0.0:5000/login?id='+ctx.chat.id }
                ])
            ));
        });
});
// the message that should be shown after a successful login is wrapped in a function because 
// it is called from external
bot.onLoginSuccess = function(id){
    var payload = arguments[1] || "";
    bot.telegram.sendMessage( id, 'OK läuft... ' + payload, operation );
};
// Actions to handle user inputs like...


// update data and return current account balance
bot.hears('Debug', function(ctx){
    console.log( '---Debug:', JSON.stringify(ctx) );
    com.checkSessionToken(ctx.chat.id, function(session){
        return ctx.reply("Session: " + JSON.stringify(session), nullkeyboard );
    });
});

bot.hears('Show my account balance', function(ctx){
    console.log(ctx.message);

    com.getAccountBalance(ctx.chat.id, function(balance){
        return ctx.reply( 'Dein Kontostand beträgt: ' + balance, operation);
    });
});

bot.hears('Show last transactions', function(ctx){
    console.log(ctx.message);
    return ctx.reply('soon...', operation);
});

bot.hears('Logout', function(ctx){
    console.log(ctx.message);
    return ctx.reply('You are going to revoke the access...', logout);
});
// destroy session and delete watch intent... answer with "Start..."
bot.on('callback_query', function(ctx){
    if( ctx.callbackQuery.data == "Logout" ){
        return ctx.answerCallbackQuery("Oh, "+ctx.callbackQuery.data+"! Great choise", true)
            .then(function(){
                return ctx.reply('Tja, schade...', login);
            });
    }
});
 
// Debug... 
bot.on('message', function(ctx){
    console.log("_Bot Input:", ctx);
    //return ctx.reply("Reply: "+ctx.message.text, operation );
    //ctx.telegram.sendCopy(ctx.from.id, "Reply: "+ctx.message, {});
});

console.log('bot server started...');

module.exports = bot;