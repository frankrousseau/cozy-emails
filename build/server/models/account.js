// Generated by CoffeeScript 1.7.1
var Account, AccountConfigError, Mailbox, Message, Promise, americano, log, nodemailer, _,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

americano = require('americano-cozy');

Account = (function() {
  function Account() {}

  return Account;

})();

module.exports = Account = americano.getModel('Account', {
  label: String,
  name: String,
  login: String,
  password: String,
  accountType: String,
  smtpServer: String,
  smtpPort: Number,
  smtpSSL: Boolean,
  smtpTLS: Boolean,
  imapServer: String,
  imapPort: Number,
  imapSSL: Boolean,
  imapTLS: Boolean,
  inboxMailbox: String,
  draftMailbox: String,
  sentMailbox: String,
  trashMailbox: String,
  junkMailbox: String,
  allMailbox: String,
  favorites: function(x) {
    return x;
  }
});

nodemailer = require('nodemailer');

Mailbox = require('./mailbox');

Promise = require('bluebird');

Message = require('./message');

AccountConfigError = require('../utils/errors').AccountConfigError;

log = require('../utils/logging')({
  prefix: 'models:account'
});

_ = require('lodash');

Account.prototype.isTest = function() {
  return this.accountType === 'TEST';
};

Account.refreshAllAccounts = function() {
  return Account.requestPromised('all').serie(function(account) {
    if (account.isTest()) {
      return null;
    }
    return account.imap_fetchMails();
  });
};

Account.prototype.toObjectWithMailbox = function() {
  return Mailbox.getClientTree(this.id).then((function(_this) {
    return function(mailboxes) {
      var rawObject;
      rawObject = _this.toObject();
      rawObject.favorites = rawObject.favorites || [];
      rawObject.mailboxes = mailboxes;
      return rawObject;
    };
  })(this));
};

Account.createIfValid = function(data) {
  var account, pAccountReady, pBoxes;
  account = new Account(data);
  pBoxes = account.isTest() ? Promise.resolve([]) : account.testSMTPConnection().then(function() {
    return account.imap_getBoxes(data);
  });
  pAccountReady = pBoxes.tap(function() {
    return Account.createPromised(account).then(function(created) {
      return account = created;
    });
  }).map(function(box) {
    box.accountID = account.id;
    return Mailbox.createPromised(box);
  }).then(function(boxes) {
    return account.imap_scanBoxesForSpecialUse(boxes);
  });
  pAccountReady.then(function(account) {
    return account.imap_fetchMails(100).then(function() {
      return account.imap_fetchMails();
    })["catch"](function(err) {
      return log.error("FETCH MAIL FAILED", err.stack || err);
    });
  });
  return pAccountReady;
};

Account.prototype.forgetBox = function(boxid) {
  var attribute, change, _i, _len, _ref;
  change = false;
  _ref = Object.keys(Mailbox.RFC6154);
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    attribute = _ref[_i];
    if (!(this[attribute] === boxid)) {
      continue;
    }
    this[attribute] = null;
    change = true;
  }
  if (__indexOf.call(this.favorites, boxid) >= 0) {
    this.favorites = _.without(this.favorites, boxid);
    change = true;
  }
  if (change) {
    return this.savePromised();
  } else {
    return Promise.resolve(this);
  }
};

Account.prototype.destroyEverything = function() {
  var accountDestroyed, accountID;
  accountDestroyed = this.destroyPromised();
  accountID = this.id;
  accountDestroyed.then(function() {
    return Mailbox.destroyByAccount(accountID);
  }).then(function() {
    return Message.safeDestroyByAccountID(accountID);
  });
  return accountDestroyed;
};

require('./account_imap');

require('./account_smtp');

Promise.promisifyAll(Account, {
  suffix: 'Promised'
});

Promise.promisifyAll(Account.prototype, {
  suffix: 'Promised'
});
