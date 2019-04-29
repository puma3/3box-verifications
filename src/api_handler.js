// eslint-disable-next-line import/prefer-default-export
const AWS = require('aws-sdk')

const TwitterHandler = require('./api/twitter')
const EmailSendHandler = require('./api/email_send')
const EmailVerifyHandler = require('./api/email_verify')
const DidDocumentHandler = require('./api/diddoc')

const TwitterMgr = require('./lib/twitterMgr')
const EmailMgr = require('./lib/emailMgr')
const EmailMgrV2 = require('./lib/emailMgrV2')
const ClaimMgr = require('./lib/claimMgr')

let twitterMgr = new TwitterMgr()
let claimMgr = new ClaimMgr()
let emailMgr = new EmailMgr()
let emailMgrV2 = new EmailMgrV2()

const doHandler = (handler, event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false
  handler.handle(event, context, (err, resp) => {
    let body = JSON.stringify({})
    if (handler.name === 'DidDocumentHandler') {
      body = JSON.stringify(resp)
    } else {
      body = JSON.stringify({
        status: 'success',
        data: resp
      })
    }
    let response
    if (err == null) {
      response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: body
      }
    } else {
      let code = 500
      if (err.code) code = err.code
      let message = err
      if (err.message) message = err.message

      response = {
        statusCode: code,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({
          status: 'error',
          message: message
        })
      }
    }

    callback(null, response)
  })
}

const preHandler = (handler, event, context, callback) => {
  if (!twitterMgr.isSecretsSet() || !claimMgr.isSecretsSet() || !emailMgr.isSecretsSet()) {
    const kms = new AWS.KMS()
    kms
      .decrypt({ CiphertextBlob: Buffer.from(process.env.SECRETS, 'base64') })
      .promise()
      .then(data => {
        const decrypted = String(data.Plaintext)
        twitterMgr.setSecrets(JSON.parse(decrypted))
        claimMgr.setSecrets(JSON.parse(decrypted))
        emailMgr.setSecrets(JSON.parse(decrypted))
        doHandler(handler, event, context, callback)
      })
  } else {
    doHandler(handler, event, context, callback)
  }
}

let twitterHandler = new TwitterHandler(twitterMgr, claimMgr)
module.exports.twitter = (event, context, callback) => {
  preHandler(twitterHandler, event, context, callback)
}

let emailSendHandler = new EmailSendHandler(emailMgr)
module.exports.email_send = (event, context, callback) => {
  preHandler(emailSendHandler, event, context, callback)
}

let emailSendHandlerV2 = new EmailSendHandler(emailMgrV2, false)
module.exports.v2_start_email_verification = (event, context, callback) => {
  preHandler(emailSendHandlerV2, event, context, callback)
}

let emailVerifyHandler = new EmailVerifyHandler(emailMgr, claimMgr)
module.exports.email_verify = (event, context, callback) => {
  preHandler(emailVerifyHandler, event, context, callback)
}

let didDocumentHandler = new DidDocumentHandler(claimMgr)
module.exports.diddoc = (event, context, callback) => {
  preHandler(didDocumentHandler, event, context, callback)
}


module.exports.v2_finalize_email_verification = (event, context, callback) => {
  /**
   * {
   *   verification: <the input-verification-claim signed by the did of the user>
   * }
   * https://www.notion.so/threebox/Onboarding-2-5-spec-d11470694816404196a772b55d5c56e4#2cafde58196a492f8650bb2e56ab4cdd
   */
}