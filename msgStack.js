/**
 * Created by Anton on 21.05.2016.
 */
"use strict";
const base = require('./base');
const debug = require('debug')('app:msgStack');
const debugLog = require('debug')('app:msgStack:log');
debugLog.log = console.log.bind(console);

var MsgStack = function (options) {
    var _this = this;
    this.gOptions = options;
    this.config = {};

    options.events.on('checkStack', function () {
        _this.checkStack();
    });

    this.onReady = this.init();
};

MsgStack.prototype.init = function () {
    var _this = this;
    var db = this.gOptions.db;
    var promise = Promise.resolve();
    promise = promise.then(function () {
        return new Promise(function (resolve, reject) {
            db.connection.query('\
                CREATE TABLE IF NOT EXISTS `streams` ( \
                    `id` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                    `channelId` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                    `data` LONGTEXT CHARACTER SET utf8mb4 NOT NULL, \
                    `imageFileId` TEXT CHARACTER SET utf8mb4 NULL, \
                    `insertTime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, \
                    `checkTime` INT NOT NULL, \
                    `offlineTime` INT NULL DEFAULT 0, \
                    `isOffline` INT NOT NULL DEFAULT 0, \
                    `isTimeout` INT NOT NULL DEFAULT 0, \
                INDEX `insertTime_idx` (`insertTime` ASC), \
                UNIQUE INDEX `id_UNIQUE` (`id` ASC), \
                FOREIGN KEY (`channelId`) \
                    REFERENCES `channels` (`id`) \
                    ON DELETE CASCADE \
                    ON UPDATE CASCADE); \
            ', function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
    promise = promise.then(function () {
        return new Promise(function (resolve, reject) {
            db.connection.query('\
                CREATE TABLE IF NOT EXISTS `liveMessages` ( \
                    `id` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                    `chatId` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                    `streamId` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                    `type` VARCHAR(191) CHARACTER SET utf8mb4 NULL, \
                    `chat_id` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                UNIQUE INDEX `chatIdStreamId_UNIQUE` (`id` ASC, `chatId` ASC), \
                INDEX `id_idx` (`id` ASC),  \
                INDEX `chatId_idx` (`chatId` ASC),  \
                INDEX `streamId_idx` (`streamId` ASC),  \
                FOREIGN KEY (`streamId`) \
                    REFERENCES `streams` (`id`) \
                    ON DELETE CASCADE \
                    ON UPDATE CASCADE,\
                FOREIGN KEY (`chatId`) \
                    REFERENCES `chats` (`id`) \
                    ON DELETE CASCADE \
                    ON UPDATE CASCADE); \
            ', function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
    promise = promise.then(function () {
        return new Promise(function (resolve, reject) {
            db.connection.query('\
                CREATE TABLE IF NOT EXISTS `chatIdStreamId` ( \
                    `chatId` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                    `streamId` VARCHAR(191) CHARACTER SET utf8mb4 NOT NULL, \
                    `messageId` VARCHAR(191) CHARACTER SET utf8mb4 NULL, \
                    `messageType` VARCHAR(191) CHARACTER SET utf8mb4 NULL, \
                    `messageChatId` VARCHAR(191) CHARACTER SET utf8mb4 NULL, \
                    `timeout` INT NULL DEFAULT 0, \
                UNIQUE INDEX `chatIdStreamId_UNIQUE` (`chatId` ASC, `streamId` ASC, `messageId` ASC), \
                FOREIGN KEY (`streamId`) \
                    REFERENCES `streams` (`id`) \
                    ON DELETE CASCADE \
                    ON UPDATE CASCADE,\
                FOREIGN KEY (`chatId`) \
                    REFERENCES `chats` (`id`) \
                    ON DELETE CASCADE \
                    ON UPDATE CASCADE,\
                FOREIGN KEY (`messageId`) \
                    REFERENCES `liveMessages` (`id`) \
                    ON DELETE CASCADE \
                    ON UPDATE CASCADE); \
            ', function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
    return promise;
};

/**
 * @typedef {{}} Stream
 * @property {string} id
 * @property {string} channelId
 * @property {{}} data
 * @property {boolean} data.isRecord
 * @property {number} data.viewers
 * @property {string} data.game
 * @property {string[]} data.preview
 * @property {string} [data.created_at]
 * @property {{}} data.channel
 * @property {string} data.channel.name
 * @property {string} data.channel.status
 * @property {string} data.channel.url
 * @property {string|null} imageFileId
 * @property {string} insertTime
 * @property {number} checkTime
 * @property {number} offlineTime
 * @property {number} isOffline
 * @property {number} isTimeout
 */

/**
 * @param {{}} dbStream
 * @return {Stream|null}
 */
const dbStreamToStream = function (dbStream) {
    if (dbStream) {
        dbStream.data = JSON.parse(dbStream.data);
    }
    return dbStream || null;
};

MsgStack.prototype.deSerializeStreamRow = dbStreamToStream;

/**
 * @param {string[]} channelIds
 * @return {Promise.<Object[]>}
 */
MsgStack.prototype.getStreams = function (channelIds) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        if (!channelIds.length) {
            return resolve([]);
        }
        db.connection.query('\
            SELECT * FROM streams WHERE channelId IN ?; \
        ', [[channelIds]], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

/**
 * @return {Promise.<Object[]>}
 */
MsgStack.prototype.getAllStreams = function () {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT * FROM streams; \
        ', function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

/**
 * @return {Promise.<Object[]>}
 */
MsgStack.prototype.getLastStreamList = function () {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT * FROM streams ORDER BY insertTime ASC; \
        ', function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results.map(function (item) {
                    var data = JSON.parse(item.data);
                    data._id = item.id;
                    data._photoId = item.imageFileId;
                    data._isOffline = !!item.isOffline;
                    data._isTimeout = !!item.isTimeout;
                    data._channelId = item.channelId;
                    return data;
                }));
            }
        });
    });
};

/**
 * @param {Object} connection
 * @param {Object} stream
 * @return {Promise}
 */
MsgStack.prototype.setStream = function (connection, stream) {
    return new Promise(function (resolve, reject) {
        connection.query('\
            INSERT INTO streams SET ? ON DUPLICATE KEY UPDATE ?; \
        ', [stream, stream], function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

/**
 * @param {string[]} streamIds
 * @return {Promise}
 */
MsgStack.prototype.removeStreamIds = function (streamIds) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        if (!streamIds.length) {
            return resolve();
        }
        db.connection.query('\
            DELETE FROM streams WHERE id IN ?; \
        ', [[streamIds]], function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

/**
 * @param {Object} connection
 * @param {string[]} chatIds
 * @param {string} streamId
 * @return {Promise}
 */
MsgStack.prototype.addChatIdsStreamId = function (connection, chatIds, streamId) {
    return new Promise(function (resolve, reject) {
        if (!chatIds.length) {
            return resolve();
        }
        var values = chatIds.map(function (chatId) {
            return [chatId, streamId];
        });
        connection.query('\
            INSERT INTO chatIdStreamId (chatId, streamId) VALUES ? ON DUPLICATE KEY UPDATE chatId = chatId; \
        ', [values], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * @param {Object} connection
 * @param {Object[]} messages
 * @param {string} streamId
 * @return {Promise}
 */
MsgStack.prototype.updateChatIdsStreamId = function (connection, messages, streamId) {
    return new Promise(function (resolve, reject) {
        if (!messages.length) {
            return resolve();
        }
        var values = messages.map(function (message) {
            return [message.chatId, message.id, message.chat_id, message.type, streamId];
        });
        connection.query('\
            INSERT INTO chatIdStreamId (chatId, messageId, messageChatId, messageType, streamId) VALUES ? ON DUPLICATE KEY UPDATE chatId = chatId; \
        ', [values], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * @param {string} streamId
 * @return {Promise}
 */
MsgStack.prototype.getStreamMessages = function (streamId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT * FROM liveMessages WHERE streamId = ?; \
        ', [streamId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

/**
 * @param {Object} message
 * @param {String} message.type
 * @param {String} message.chat_id
 * @param {String} message.streamId
 * @param {String} message.chatId
 * @param {String} message.id
 * @return {Promise}
 */
MsgStack.prototype.addStreamMessage = function (message) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            INSERT INTO liveMessages SET ? ON DUPLICATE KEY UPDATE ?; \
        ', [message, message], function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

/**
 * @param {string} messageId
 * @return {Promise}
 */
MsgStack.prototype.removeStreamMessage = function (messageId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            DELETE FROM liveMessages WHERE id = ?; \
        ', [messageId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * @param {Object} connection
 * @param {string} prevStreamId
 * @param {string} streamId
 * @return {Promise}
 */
MsgStack.prototype.migrateStream = function (connection, prevStreamId, streamId) {
    return new Promise(function (resolve, reject) {
        connection.query('\
            UPDATE streams SET id = ? WHERE id = ?; \
        ', [streamId, prevStreamId], function (err) {
            if (err) {
                reject(err);
            } else {
                debugLog('[migrate stream] %s > %s', prevStreamId, streamId);
                resolve();
            }
        });
    });
};

/**
 * @param {string} streamId
 * @param {string} imageFileId
 * @return {Promise}
 */
MsgStack.prototype.setImageFileId = function (streamId, imageFileId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            UPDATE streams SET imageFileId = ? WHERE id = ?; \
        ', [imageFileId, streamId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    }).catch(function (err) {
        debug('setImageFileId error %o', err);
    });
};

/**
 * @param {string} chatId
 * @param {string} streamId
 * @param {string} messageId
 * @return {Promise}
 */
MsgStack.prototype.removeItem = function (chatId, streamId, messageId) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        var query = '';
        if (messageId) {
            query = 'DELETE FROM chatIdStreamId WHERE chatId = ? AND streamId = ? AND messageId = ?;';
        } else {
            query = 'DELETE FROM chatIdStreamId WHERE chatId = ? AND streamId = ? AND messageId IS ?;';
        }
        db.connection.query(query, [chatId, streamId, messageId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * @param {string} chatId
 * @param {string} messageId
 * @param {boolean} isPhoto
 */
MsgStack.prototype.updateLog = function (chatId, messageId, isPhoto) {
    debugLog('[update] %s %s %s', isPhoto ? '(p)' : '(t)', messageId, chatId);
};

/**
 * @param {string} chatId
 * @param {string} messageId
 * @param {boolean} isPhoto
 */
MsgStack.prototype.sendLog = function (chatId, messageId, isPhoto) {
    debugLog('[send] %s %s %s', isPhoto ? '(p)' : '(t)', messageId, chatId);
};

/**
 * @param {string} chatId
 * @param {string} streamId
 * @param {string} messageId
 * @param {Number} timeout
 */
MsgStack.prototype.setTimeout = function (chatId, streamId, messageId, timeout) {
    var db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        var query = '';
        if (messageId) {
            query = 'UPDATE chatIdStreamId SET timeout = ? WHERE chatId = ? AND streamId = ? AND messageId = ?;';
        } else {
            query = 'UPDATE chatIdStreamId SET timeout = ? WHERE chatId = ? AND streamId = ? AND messageId IS ?;';
        }
        db.connection.query(query, [timeout, chatId, streamId, messageId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * @typedef {{}} DbChatIdStreamId
 * @property {string} chatId
 * @property {string} streamId
 * @property {string|null} messageId
 * @property {string|null} messageType
 * @property {string|null} messageChatId
 * @property {number|null} timeout
 */

/**
 * @typedef {{}} DbStream
 * @property {string} id
 * @property {string} channelId
 * @property {string} data
 * @property {string|null} imageFileId
 * @property {string} insertTime
 * @property {number} checkTime
 * @property {number} offlineTime
 * @property {boolean} isOffline
 * @property {boolean} isTimeout
 */

/**
 * @typedef {{}} StackItem
 * @property {DbChatIdStreamId} chatIdStreamId
 * @property {DbStream} streams
 * @property {Chat} chats
 */
/**
 * @return {Promise.<StackItem[]>}
 */
MsgStack.prototype.getStackItems = function () {
    const self = this;
    const db = this.gOptions.db;
    return new Promise(function (resolve, reject) {
        db.connection.query('\
            SELECT \
            ' + db.wrapTableParams('chatIdStreamId', ['chatId', 'streamId', 'messageId', 'messageType', 'messageChatId', 'timeout']) + ', \
            ' + db.wrapTableParams('streams', ['id', 'channelId', 'data', 'imageFileId', 'insertTime', 'checkTime', 'offlineTime', 'isOffline', 'isTimeout']) + ', \
            ' + db.wrapTableParams('chats', ['id', 'channelId', 'options', 'insertTime']) + ' \
            FROM chatIdStreamId \
            INNER JOIN streams ON chatIdStreamId.streamId = streams.id \
            INNER JOIN chats ON chatIdStreamId.chatId = chats.id \
            WHERE chatIdStreamId.timeout < ? \
            LIMIT 30; \
        ', [base.getNow()], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results.map(function (row) {
                    const item = db.unWrapTableParams(row);
                    item.chats = self.gOptions.users.deSerializeChatRow(item.chats);
                    return item;
                }));
            }
        });
    });
};

/**
 * @param {Error} err
 * @return {Promise}
 */
MsgStack.prototype.onSendMessageError = function (err) {
    var _this = this;
    /**
     * @type {Object}
     * @property {string} type
     * @property {string} id
     * @property {string} chatId
     */
    var itemObj = err.itemObj;
    var result = null;
    if (err.code === 'ETELEGRAM') {
        var body = err.response.body;

        var isBlocked = body.error_code === 403;
        if (!isBlocked) {
            isBlocked = [
                /group chat is deactivated/,
                /chat not found/,
                /channel not found/,
                /USER_DEACTIVATED/,
                /not enough rights to send photos to the chat/,
                /have no rights to send a message/,
                /need administrator rights in the channel chat/,
                /CHAT_WRITE_FORBIDDEN/,
                /CHAT_SEND_MEDIA_FORBIDDEN/
            ].some(function (re) {
                return re.test(body.description);
            });
        }

        if (isBlocked) {
            if (itemObj.type === 'chat') {
                result = _this.gOptions.users.removeChat(itemObj.chatId, body.description);
            } else {
                result = _this.gOptions.users.removeChatChannel(itemObj.chatId, itemObj.id, body.description).then(function () {
                    const text = 'Channel ' + itemObj.id + ' removed. Reason: ' + body.description;
                    return _this.gOptions.bot.sendMessage(itemObj.chatId, text).catch(function (err) {
                        debug('Send message about channel error! %s %s %o', itemObj.chatId, itemObj.id, err);
                    });
                });
            }
        } else
        if (itemObj.type === 'chat' && body.parameters && body.parameters.migrate_to_chat_id) {
            result = _this.gOptions.users.changeChatId(itemObj.chatId, body.parameters.migrate_to_chat_id);
        }
    }

    if (!result) {
        throw err;
    }

    return result;
};

/**
 * @param {StackItem} item
 * @return {Promise}
 */
MsgStack.prototype.updateItem = function (item) {
    var _this = this;
    var chatId = item.chats.id;
    var streamId = item.streams.id;
    var messageId = item.chatIdStreamId.messageId;
    var chat_id = item.chatIdStreamId.messageChatId;
    var messageType = item.chatIdStreamId.messageType;

    var timeout = 5 * 60;
    return _this.setTimeout(chatId, streamId, messageId, base.getNow() + timeout).then(function () {
        var data = JSON.parse(item.streams.data);
        data._id = item.streams.id;
        data._isOffline = !!item.streams.isOffline;
        data._isTimeout = !!item.streams.isTimeout;
        data._channelId = item.streams.channelId;

        var text = base.getNowStreamText(_this.gOptions, data);
        var caption = base.getNowStreamPhotoText(_this.gOptions, data);

        return _this.gOptions.msgSender.updateMsg({
            id: messageId,
            type: messageType,
            chat_id: chat_id
        }, caption, text).then(function () {
            let isPhoto = messageType === 'streamPhoto';
            if (messageType === 'streamPhoto') {
                _this.gOptions.tracker.track(chat_id, 'bot', 'updatePhoto', data._channelId);
            } else
            if (messageType === 'streamText'){
                _this.gOptions.tracker.track(chat_id, 'bot', 'updateText', data._channelId);
            }
            _this.updateLog(chat_id, streamId, isPhoto);
        }).catch(function (err) {
            if (err.code === 'ETELEGRAM') {
                var body = err.response.body;

                var isBlocked = body.error_code === 403;
                if (!isBlocked) {
                    isBlocked = [
                        /group chat is deactivated/,
                        /chat not found/,
                        /channel not found/,
                        /USER_DEACTIVATED/,
                        /not enough rights to send photos to the chat/,
                        /need administrator rights in the channel chat/
                    ].some(function (re) {
                        return re.test(body.description);
                    });
                }

                if (!isBlocked) {
                    isBlocked = [
                        /message to edit not found/
                    ].some(function (re) {
                        return re.test(body.description);
                    });
                }

                if (isBlocked) {
                    return _this.removeStreamMessage(messageId);
                } else
                if (/message is not modified/.test(body.description)) {
                    return;
                }
            }
            throw err;
        });
    }).then(function () {
        return _this.removeItem(chatId, streamId, messageId);
    }).catch(function (err) {
        debug('updateItem %s %s %o', chat_id, streamId, err);

        return _this.setTimeout(chatId, streamId, messageId, base.getNow() + timeout);
    });
};

MsgStack.prototype.sendStreamMessage = function (chat_id, streamId, message, data, useCache, chatId, autoClean) {
    var _this = this;
    return _this.gOptions.msgSender.sendMessage(chat_id, streamId, message, data, useCache).then(function (msg) {
        var isPhoto = !!msg.photo;

        _this.gOptions.tracker.track(chat_id, 'bot', isPhoto ? 'sendPhoto' : 'sendMsg', data._channelId);

        _this.sendLog(chat_id, streamId, isPhoto);

        return _this.addStreamMessage({
            type: isPhoto ? 'streamPhoto' : 'streamText',
            chat_id: chat_id,
            id: msg.message_id,
            streamId: data._id,
            chatId: chatId
        }).then(function () {
            if (autoClean) {
                return _this.gOptions.botMessages.insertDeleteMessage(chatId, data._id, chat_id, msg.message_id);
            }
        });
    });
};

/**
 * @param {StackItem} item
 * @return {Promise}
 */
MsgStack.prototype.sendItem = function (item) {
    var _this = this;
    var chatId = item.chats.id;
    var streamId = item.streams.id;
    var imageFileId = item.streams.imageFileId;
    var messageId = item.chatIdStreamId.messageId;

    var timeout = 5 * 60;
    return _this.setTimeout(chatId, streamId, messageId, base.getNow() + timeout).then(function () {
        var data = JSON.parse(item.streams.data);
        data._id = item.streams.id;
        data._isOffline = !!item.streams.isOffline;
        data._isTimeout = !!item.streams.isTimeout;
        data._channelId = item.streams.channelId;

        const chat = item.chats;
        var options = chat.options;

        if (data.isRecord && !options.unMuteRecords) {
            return;
        }

        var text = base.getNowStreamText(_this.gOptions, data);
        var caption = '';

        if (!options.hidePreview) {
            caption = base.getNowStreamPhotoText(_this.gOptions, data);
        }

        var message = {
            imageFileId: imageFileId,
            caption: caption,
            text: text
        };

        var chatList = [{
            type: 'chat',
            id: chat.id,
            chatId: chat.id
        }];
        if (chat.channelId) {
            chatList.push({
                type: 'channel',
                id: chat.channelId,
                chatId: chat.id
            });
            if (options.mute) {
                chatList.shift();
            }
        }

        const autoClean = !!options.autoClean;

        var promise = Promise.resolve();
        chatList.forEach(function (itemObj) {
            var chat_id = itemObj.id;
            promise = promise.then(function () {
                return _this.sendStreamMessage(chat_id, streamId, message, data, true, chat.id, autoClean);
            }).catch(function (err) {
                err.itemObj = itemObj;
                throw err;
            });
        });

        return promise.catch(function (err) {
            return _this.onSendMessageError(err);
        });
    }).then(function () {
        return _this.removeItem(chatId, streamId, messageId);
    }).catch(function (err) {
        debug('sendItem %s %s %o', chatId, streamId, err);

        if (/PEER_ID_INVALID/.test(err)) {
            timeout = 6 * 60 * 60;
        }
        return _this.setTimeout(chatId, streamId, messageId, base.getNow() + timeout);
    });
};

var activeChatIds = [];
var activePromises = [];

MsgStack.prototype.checkStack = function () {
    var _this = this;
    var limit = 10;
    if (activePromises.length >= limit) return;

    _this.getStackItems().then(function (/*StackItem[]*/items) {
        items.some(function (item) {
            var chatId = item.chats.id;

            if (activePromises.length >= limit) return true;
            if (activeChatIds.indexOf(chatId) !== -1) return;

            var promise = null;
            if (item.chatIdStreamId.messageId) {
                promise = _this.updateItem(item);
            } else {
                promise = _this.sendItem(item);
            }
            activeChatIds.push(chatId);
            activePromises.push(promise);

            var any = function () {
                base.removeItemFromArray(activeChatIds, chatId);
                base.removeItemFromArray(activePromises, promise);
                _this.checkStack();
            };

            promise.then(function (result) {
                any();
                return result;
            }, function (err) {
                any();
                throw err;
            });
        });
    });
};

module.exports = MsgStack;