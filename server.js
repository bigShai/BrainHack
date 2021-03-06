var express = require('express');
var fs = require('fs');
var WebSocketClient = require('websocket').client;
var app = express();
_ = require('underscore');
var cors = require("cors");

var plivo = require('plivo').RestAPI({
    authId: 'MAYTK2MDHLZDQ4MDM5NJ',
    authToken: 'NTkzMDY3OWU2NGQxYTUyNjdmNzJkNWJlNGNmM2Jj'
});

var beta = [];
var theta = [];

var betaThreshold = -0.8;
var thetaThreshold = -0.5;

var smsLog = [ 1449750873303,1448750873303, 1447750873303];
var resend = true;
var recall = true;

function getData(){
    var client = new WebSocketClient();

    client.on('connectFailed', function(error) {
        console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function(connection) {
        console.log('WebSocket Client Connected');
        connection.on('error', function(error) {
            console.log("Connection Error: " + error.toString());
        });
        connection.on('close', function() {
            console.log('echo-protocol Connection Closed');
        });
        connection.on('message', function(message) {
            if (message.type === 'utf8') {
                var data = JSON.parse(message.utf8Data).features;
                var values = _.values(JSON.parse(message.utf8Data).features);
                //console.log(values.toString());

                //appendToFile(values.toString() + '\n');

                beta.push(data.beta);
                theta.push(data.theta);

                checkThresholds(10);
            }
        });

    });

    client.connect('ws://cloud.neurosteer.com:8080/v1/features/0006664E5C06/pull');
}

function checkThresholds(windowSize){
    console.log('Checking Thresholds..');
    var betaAvg = sampleAvg(beta, windowSize);
    var thetaAvg = sampleAvg(theta, windowSize);

    console.log('beta: ' + betaAvg + ' theta: '+ thetaAvg);

    if (betaAvg > betaThreshold && thetaAvg > thetaThreshold){
        //sendSMS();
        console.log('Patient is NOT OK!!!! :(');
        callPatient();
    } else {
        console.log('Patient is OK :)');
    }
}

function appendToFile(msg){
    fs.appendFile('data.csv', msg, function (err) {
        if (err) throw err;
    });
}

function sampleAvg(arr, windowSize){
    if (arr.length < windowSize){
        console.log('Waiting for more data..');
        return undefined;
    }

    var i = arr.length - windowSize;
    var sum = 0;
    while(i < arr.length){
        sum += arr[i];
        i++;
    }

    return sum/windowSize;
}



function sendSMS(){
    if (!resend){
        return;
    }

    resend = false;
    setTimeout(function(){
        resend = true;
    }, 60 * 1000);

    console.log('Sending SMS..');
    var params = {
        'src': 'CalmMe',
        'dst' : '+972545801707',
        'text' : 'Calm Down! http://www.nba.com',
        'type' : 'sms'
    };

    plivo.send_message(params, function (status, response) {
        if (status >= 400) {
            console.log('Plivo: Failed sending sms. errStatus: ' + status + ' err: ' + JSON.stringify(response));
        }

        console.log('SMS sent to: ' + params.dst + ' msg: ' + params.text);
        smsLog.push((new Date()).getTime());
    });
}

getData();


function callPatient(){
    if (!recall){
        return;
    }

    recall = false;
    setTimeout(function(){
        recall = true;
    }, 60 * 1000);

    var params = {
        from: '+972545801707',
        to: '+972545801707',
        answer_url: 'http://172.16.59.192:8000/answer'
    };

    plivo.make_call(params, function(status, response) {
        if (status >= 200 && status < 300) {
            console.log('CALLING PATIENT NOW!!');
        } else {
            console.log('Oops! Something went wrong.');
        }
    });
}


app.get('/data', function (req, res) {
    fs.readFile('data.csv', function (err, data) {
        if (err) throw err;
        res.send(data);
    });
});

app.get('/smslog', function (req, res) {
    res.json({ log: smsLog});
});

app.get('/thresholds', function (req, res) {
    //betaThreshold = (req.query.beta - 50)/50;
    //thetaThreshold = (req.query.theta - 50)/50;

    console.log('betaThreshold:'+ betaThreshold + ' thetaThreshold:' + thetaThreshold );

    res.json({
        betaThreshold: betaThreshold,
        thetaThreshold: thetaThreshold
    });
});

app.use(cors());

var server = app.listen(80, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
