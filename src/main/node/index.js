const url = require('url');
const https = require('https');

const webhook = process.env.SLACK_WEBHOOK;

const processEvent = function (event, context) {
    const message = JSON.parse(event.Records[0].Sns.Message);

    // Format Slack posting message
    const text = "<!channel> *" + message.AlarmDescription + "* state is now `" + message.NewStateValue + "`\n" +
        "```" +
        "reason: " + message.NewStateReason + "\n" +
        "alarm: " + message.AlarmName + "\n" +
        "time: " + message.StateChangeTime +
        "```"
    ;

    const slackMessage = {
        text: text
    };

    postMessage(slackMessage, function (response) {
        if (response.statusCode < 400) {
            console.info('Message posted!');
            context.succeed();
        } else if (response.statusCode < 500) {
            // Don't retry when got 4xx cuz its request error
            console.error("4xx error occurred when processing message: " + response.statusCode + " - " + response.statusMessage);
            context.succeed();
        } else {
            // Retry Lambda func when got 5xx errors
            context.fail("Server error when processing message: " + response.statusCode + " - " + response.statusMessage);
        }
    });
};

const postMessage = function (message, callback) {
    const body = JSON.stringify(message);

    const options = url.parse(webhook);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    };

    const req = https.request(options, function (res) {
        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            return chunks.push(chunk);
        });
        res.on('end', function () {
            let body = chunks.join('');
            if (callback) {
                callback({
                    body: body,
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage
                });
            }
        });
        return res;
    });

    req.write(body);
    req.end();
};

exports.handler = function (event, context) {
    if (webhook) {
        processEvent(event, context);
    } else {
        context.fail('Missing Slack Hook URL.');
    }
};
