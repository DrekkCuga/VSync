require('dotenv').config();

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');
var mysql = require('mysql');
var webhook = require("webhook-discord");
var http = require("http");
var https = require("https");
users = [];
connections = [];
rooms = [];
// Store all of the sockets and their respective room numbers
userrooms = {}

YT3_API_KEY = "AIzaSyCEc0w2faZFftIynhOfjUSW8YIQDFPBMkI";
DM_API_KEY = process.env.DM_API_KEY;

var keepVsyncAlive = true;
var pageLink = "https://vsync.vk3mag.net/";

// Set given room for url parameter
var given_room = ""

app.use(express.static(__dirname + '/public'));

server.listen(process.env.PORT || 3000);
console.log('Server Started . . .');


app.get('/:room', function(req, res) {
    given_room = req.params.room
    res.sendFile(__dirname + '/public/index.html');
});


var roomno = 1;
//logging settings
const logToFile = true;
const logToSql = false;
const logToDiscordWebHook = false;
//SQL LOGGING
var sqlConnected = false;

if (logToSql) {
    var sqlConnection = mysql.createConnection({
        host: "",
        user: "",
        password: "",
        database: ""
    });

    sqlConnection.connect(function(err) {
        if (err) {
            console.log("Failed to connect to the database");
            sqlConnected = false;
        } else {
            console.log("Successfully connected to the database");
            sqlConnected = true;
        }
    });
}
//DISCORD WEBHOOK LOGGING
if (logToDiscordWebHook) {
    //the discord webhook url
    var discordHook = new webhook.Webhook("");
}

io.sockets.on('connection', function(socket) {
    try {

        // Connect Socket
        connections.push(socket);
        console.log('Connected: %s sockets connected', connections.length);

		if (keepVsyncAlive && connections.length > 0) {
			var keepAliveTimer = setInterval(function() {
				if (pageLink.includes('https')) {
					https.get(pageLink);
				} else {
					http.get(pageLink);
				}
				if (connections.length <= 0) {
					clearInterval(keepAliveTimer);
				}
			}, 300000);
		}

        // Set default room, if provided in url
        socket.emit('set id', {
            id: given_room
        })
        // reset url parameter
        // Workaround because middleware was not working right
        socket.on('reset url', function(data) {
            given_room = ""
        });

        // Disconnect
        socket.on('disconnect', function(data) {
            try {
                // If socket username is found
                if (users.indexOf(socket.username) != -1) {
                    users.splice((users.indexOf(socket.username)), 1);
                    updateUsernames();
                }

                connections.splice(connections.indexOf(socket), 1);
                console.log(socket.id + ' Disconnected: %s sockets connected', connections.length);


                // HOST DISCONNECT
                // Need to check if current socket is the host of the roomnum
                // If it is the host, needs to auto assign to another socket in the room

                // Grabs room from userrooms data structure
                var id = socket.id
                var roomnum = userrooms[id]
                var room = io.sockets.adapter.rooms['room-' + roomnum]

                // If you are not the last socket to leave
                if (room !== undefined) {
                    // If you are the host
                    if (socket.id == room.host) {
                        // Reassign
                        console.log("hello i am the host " + socket.id + " and i am leaving my responsibilities to " + Object.keys(room.sockets)[0])
                        io.to(Object.keys(room.sockets)[0]).emit('autoHost', {
                            roomnum: roomnum
                        })
                    }

                    // Remove from users list
                    // If socket username is found
                    if (room.users.indexOf(socket.username) != -1) {
                        room.users.splice((room.users.indexOf(socket.username)), 1);
                        updateRoomUsers(roomnum);
                    }
                }

                // Delete socket from userrooms
                delete userrooms[id]
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }

        });

        // ------------------------------------------------------------------------
        // New room
        socket.on('new room', function(data, callback) {
            try {
                //callback(true);
                // Roomnum passed through
                socket.roomnum = data;

                // This stores the room data for all sockets
                userrooms[socket.id] = data

                var host = null
                var init = false

                // Sets default room value to 1
                if (socket.roomnum == null || socket.roomnum == "") {
                    socket.roomnum = '1'
                    userrooms[socket.id] = '1'
                }

                // Adds the room to a global array
                if (!rooms.includes(socket.roomnum)) {
                    rooms.push(socket.roomnum);
                }

                // Checks if the room exists or not
                // console.log(io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined)
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] === undefined) {
                    socket.send(socket.id)
                    // Sets the first socket to join as the host
                    host = socket.id
                    init = true

                    // Set the host on the client side
                    socket.emit('setHost');
                    //console.log(socket.id)
                } else {
                    console.log(socket.roomnum)
                    host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                }

                // Actually join the room
                console.log(socket.username + " connected to room-" + socket.roomnum)
                socket.join("room-" + socket.roomnum);

                //log data
                var dataToLog = [
                    'connectionLogs',
                    socket.username + ': just joined room ' + socket.roomnum + '\n'
                ]
                log(dataToLog);

                // Sets the default values when first initializing
                if (init) {
                    // Sets the host
                    io.sockets.adapter.rooms['room-' + socket.roomnum].host = host
                    //sets the free for all state
                    io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll = false
                    // Default Player
                    io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer = 0
                    // Default video
                    io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo = {
                        yt: 'nl0KrFAMhGg',
                        dm: 'x26m1j4',
                        vimeo: '76979871',
                        html5: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                    }
                    // Previous Video
                    io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo = {
                        yt: {
                            id: 'M7lc1UVf-VE',
                            time: 0
                        },
                        dm: {
                            id: 'x26m1j4',
                            time: 0
                        },
                        vimeo: {
                            id: '76979871',
                            time: 0
                        },
                        html5: {
                            id: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                            time: 0
                        }
                    }
                    // Host username
                    io.sockets.adapter.rooms['room-' + socket.roomnum].hostName = socket.username
                    // Keep list of online users
                    io.sockets.adapter.rooms['room-' + socket.roomnum].users = [socket.username]
                    // Set an empty queue
                    io.sockets.adapter.rooms['room-' + socket.roomnum].queue = {
                        yt: [],
                        dm: [],
                        vimeo: [],
                        html5: []
                    }
                    // Set queue video number
                    io.sockets.adapter.rooms['room-' + socket.roomnum].queueNumber = 0;
                }

                // Set Host label
                io.sockets.in("room-" + socket.roomnum).emit('changeHostLabel', {
                    username: io.sockets.adapter.rooms['room-' + socket.roomnum].hostName
                })

                // Set Queue
                updateQueueVideos()

                // Gets current video from room variable
                switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                    case 0:
                        var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.yt
                        break;
                    case 1:
                        var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.dm
                        break;
                    case 2:
                        var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.vimeo
                        break;
                    case 3:
                        var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.html5
                        break;
                    default:
                        console.log("Error invalid player id")
                }
                var currYT = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.yt

                // Change the video player to current One
                switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                    case 0:
                        // YouTube is default so do nothing
                        break;
                    case 1:
                        io.sockets.in("room-" + socket.roomnum).emit('createDaily', {});
                        break;
                    case 2:
                        io.sockets.in("room-" + socket.roomnum).emit('createVimeo', {});
                        break;
                    case 3:
                        io.sockets.in("room-" + socket.roomnum).emit('createHTML5', {});
                        break;
                    default:
                        console.log("Error invalid player id")
                }

                // Change the video to the current one
                socket.emit('changeVideoClient', {
                    videoId: currVideo
                });

                // Get time from host which calls change time for that socket
                if (socket.id != host) {
                    //socket.broadcast.to(host).emit('getTime', { id: socket.id });
                    console.log("call the damn host " + host)

                    // Set a timeout so the video can load before it syncs
                    setTimeout(function() {
                        socket.broadcast.to(host).emit('getData');
                    }, 1000);
                    //socket.broadcast.to(host).emit('getData');

                    // Push to users in the room
                    io.sockets.adapter.rooms['room-' + socket.roomnum].users.push(socket.username)

                    // socket.emit('changeVideoClient', {
                    //     videoId: currVideo
                    // });

                    // This calls back the function on the host client
                    //callback(true)

                    // DISABLE CONTROLS - DEPRECATED
                    // socket.emit('hostControls');
                } else {
                    console.log("I am the host")
                    //socket.emit('auto sync');

                    // Auto syncing is not working atm
                    // socket.broadcast.to(host).emit('auto sync');
                }

                // Update online users
                updateRoomUsers(socket.roomnum)
                //set the free for all status if enabled - default for client is disabled
                if (io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll) {
                    io.sockets.in("room-" + socket.roomnum).emit('enableFreeForAll');
                }

                // This is all of the rooms
                // io.sockets.adapter.rooms['room-1'].currVideo = "this is the video"
                // console.log(io.sockets.adapter.rooms['room-1']);
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });
        // ------------------------------------------------------------------------



        // ------------------------------------------------------------------------
        // ------------------------- Socket Functions -----------------------------
        // ------------------------------------------------------------------------

        // Play video
        socket.on('play video', function(data) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    var roomnum = data.room
                    io.sockets.in("room-" + roomnum).emit('playVideoClient');
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        // Event Listener Functions
        // Broadcast so host doesn't continuously call it on itself!
        socket.on('play other', function(data) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    var roomnum = data.room
                    socket.broadcast.to("room-" + roomnum).emit('justPlay');
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        socket.on('pause other', function(data) {
            try {


                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    var roomnum = data.room
                    socket.broadcast.to("room-" + roomnum).emit('justPause');
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        socket.on('seek other', function(data) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                if (socket.id === host) {
                    var roomnum = data.room
                    var currTime = data.time
                    socket.broadcast.to("room-" + roomnum).emit('justSeek', {
                        time: currTime
                    });
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }

            // Sync up
            // host = io.sockets.adapter.rooms['room-' + roomnum].host
            // console.log("let me sync "+host)
            // socket.broadcast.to(host).emit('getData');
        });

        socket.on('play next', function(data, callback) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    var videoId = "QUEUE IS EMPTY"
                    if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                        switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                            case 0:
                                if (io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt.length > 0) {
                                    // Gets the video id from the room object
                                    videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt.shift().videoId
                                }
                                break;
                            case 1:
                                if (io.sockets.adapter.rooms['room-' + socket.roomnum].queue.dm.length > 0) {
                                    videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].queue.dm.shift().videoId
                                }
                                break;
                            case 2:
                                if (io.sockets.adapter.rooms['room-' + socket.roomnum].queue.dm.length > 0) {
                                    videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].queue.vimeo.shift().videoId
                                }
                                break;
                            case 3:
                                if (io.sockets.adapter.rooms['room-' + socket.roomnum].queue.html5.length > 0) {
                                    videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].queue.html5.shift().videoId
                                }
                                break;
                            default:
                                console.log("Error invalid player id")
                        }
                        // console.log(videoId)
                        // Remove video from the front end
                        updateQueueVideos()
                        callback({
                            videoId: videoId
                        })
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        // Sync video
        socket.on('sync video', function(data) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                    var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                    if (socket.id === host || freeForAllStat) {
                        var roomnum = data.room
                        var currTime = data.time
                        var state = data.state
                        var videoId = data.videoId
                        var playerId = io.sockets.adapter.rooms['room-' + roomnum].currPlayer
                        // var videoId = io.sockets.adapter.rooms['room-'+roomnum].currVideo
                        io.sockets.in("room-" + roomnum).emit('syncVideoClient', {
                            time: currTime,
                            state: state,
                            videoId: videoId,
                            playerId: playerId
                        })
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        // Enqueue video
        // Gets title then calls back
        socket.on('enqueue video', function(data) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    test = false
                    var user = data.user
                    var videoId = data.videoId
                    var title = ""

                    //Validate videoid.
                    if (videoId === null || videoId.length === 0)
                        return;

                    //Check if the Video is already in the playlist
                    if (typeof io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt.find(item => {
                            return item.videoId === videoId;
                        }) !== "undefined") {

                        return;
                    }


                    ++io.sockets.adapter.rooms['room-' + socket.roomnum].queueNumber;
                    switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                        case 0:
                            // See yt.js file
                            socket.emit('get title', {
                                videoId: videoId,
                                user: user,
                                video_count: String(io.sockets.adapter.rooms['room-' + socket.roomnum].queueNumber)
                            }, function(data) {
                                videoId = data.videoId
                                title = data.title
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt.push({
                                    videoId: videoId,
                                    title: title
                                })
                                console.log(io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt)
                                // Update front end
                                updateQueueVideos()
                            })
                            break;
                        case 1:
                            io.sockets.adapter.rooms['room-' + socket.roomnum].queue.dm.push({
                                videoId: videoId,
                                title: title
                            })
                            break;
                        case 2:
                            io.sockets.adapter.rooms['room-' + socket.roomnum].queue.vimeo.push({
                                videoId: videoId,
                                title: title
                            })
                            break;
                        case 3:
                            io.sockets.adapter.rooms['room-' + socket.roomnum].queue.html5.push({
                                videoId: videoId,
                                title: title
                            })
                            break;
                        default:
                            console.log("Error invalid player id")
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Enqueue playlist
        // Gets all of the playlist videos and enqueues them
        // Only supported for YouTube
        socket.on('enqueue playlist', function(data) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    var user = data.user
                    var playlistId = data.playlistId
                    switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                        case 0:
                            // See yt.js file
                            socket.emit('get playlist videos', {
                                playlistId: playlistId,
                                user: user,
                                api_key: YT3_API_KEY
                            })
                            break;
                        case 1:
                            break;
                        case 2:
                            break;
                        case 3:
                            break;
                        default:
                            console.log("Error invalid player id")
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Empty the queue
        socket.on('empty queue', function(data) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                        switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                            case 0:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt = []
                                break;
                            case 1:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.dm = []
                                break;
                            case 2:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.vimeo = []
                                break;
                            case 3:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.html5 = []
                                break;
                            default:
                                console.log("Error invalid player id")
                        }
                        updateQueueVideos()
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Remove a specific video from queue
        socket.on('remove at', function(data) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                        var idx = data.idx
                        switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                            case 0:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt.splice(idx, 1)
                                break;
                            case 1:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.dm.splice(idx, 1)
                                break;
                            case 2:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.vimeo.splice(idx, 1)
                                break;
                            case 3:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.html5.splice(idx, 1)
                                break;
                            default:
                                console.log("Error invalid player id")
                        }
                        updateQueueVideos()
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Play a specific video from queue
        socket.on('play at', function(data, callback) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                        var idx = data.idx
                        var videoId = ""
                        switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                            case 0:
                                videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt[idx].videoId
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.yt.splice(idx, 1)
                                break;
                            case 1:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.dm.splice(idx, 1)
                                break;
                            case 2:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.vimeo.splice(idx, 1)
                                break;
                            case 3:
                                io.sockets.adapter.rooms['room-' + socket.roomnum].queue.html5.splice(idx, 1)
                                break;
                            default:
                                console.log("Error invalid player id")
                        }
                        updateQueueVideos()
                        callback({
                            videoId: videoId
                        })
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Change video
        socket.on('change video', function(data, callback) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    var roomnum = data.room
                    var videoId = data.videoId
                    var time = data.time
                    var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                    var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;

                    if (socket.id === host || freeForAllStat) {

                        // This changes the room variable to the video id
                        // io.sockets.adapter.rooms['room-' + roomnum].currVideo = videoId
                        switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                            case 0:
                                // Set prev video before changing
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.yt.id = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.yt
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.yt.time = time
                                // Set new video id
                                io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.yt = videoId
                                break;
                            case 1:
                                // Set prev video before changing
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.dm.id = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.dm
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.dm.time = time
                                // Set new video id
                                io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.dm = videoId
                                break;
                            case 2:
                                // Set prev video before changing
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.vimeo.id = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.vimeo
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.vimeo.time = time
                                // Set new video id
                                io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.vimeo = videoId
                                break;
                            case 3:
                                // Set prev video before changing
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.html5.id = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.html5
                                io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.html5.time = time
                                // Set new video id
                                io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.html5 = videoId
                                break;
                            default:
                                console.log("Error invalid player id")
                        }

                        io.sockets.in("room-" + roomnum).emit('changeVideoClient', {
                            videoId: videoId
                        });


                        // If called from previous video, do a callback to seek to the right time
                        if (data.prev) {
                            // Call back to return the video id
                            callback()
                        }
                        if (socket.username != null && videoId != null) {
                            dataToLog = [
                                'videoLogs',
                                socket.username + ': ' +
                                'Changed video to ' + videoId + '\n'
                            ]
                            log(dataToLog);
                        }
                    }

                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }

            // Auto sync with host after 1000ms of changing video
            // NOT NEEDED ANYMORE, IN THE CHANGEVIDEOCLIENT FUNCTION
            // setTimeout(function() {
            //     socket.broadcast.to(host).emit('getData');
            // }, 1000);

            // console.log(io.sockets.adapter.rooms['room-1'])
        });

        // Change to previous video
        socket.on('change previous video', function(data, callback) {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                var freeForAllStat = io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll;
                if (socket.id === host || freeForAllStat) {
                    if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                        var roomnum = data.room
                        var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host

                        // This sets the videoId to the proper previous video
                        switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                            case 0:
                                var videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.yt.id
                                var time = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.yt.time
                                break;
                            case 1:
                                var videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.dm.id
                                var time = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.dm.time
                                break;
                            case 2:
                                var videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.vimeo.id
                                var time = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.vimeo.time
                                break;
                            case 3:
                                var videoId = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.html5.id
                                var time = io.sockets.adapter.rooms['room-' + socket.roomnum].prevVideo.html5.time
                                break;
                            default:
                                console.log("Error invalid player id")
                        }

                        console.log("Hot Swapping to Previous Video: " + videoId + " at current time: " + time)
                        // Callback to go back to client to request the video change
                        callback({
                            videoId: videoId,
                            time: time
                        })
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Get video id based on player
        socket.on('get video', function(callback) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    // Gets current video from room variable
                    switch (io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer) {
                        case 0:
                            var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.yt
                            break;
                        case 1:
                            var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.dm
                            break;
                        case 2:
                            var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.vimeo
                            break;
                        case 3:
                            var currVideo = io.sockets.adapter.rooms['room-' + socket.roomnum].currVideo.html5
                            break;
                        default:
                            console.log("Error invalid player id")
                    }
                    // Call back to return the video id
                    callback(currVideo)
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Change video player
        socket.on('change player', function(data) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    var roomnum = data.room
                    var playerId = data.playerId

                    io.sockets.in("room-" + roomnum).emit('pauseVideoClient');
                    // console.log(playerId)
                    switch (playerId) {
                        case 0:
                            io.sockets.in("room-" + roomnum).emit('createYoutube', {});
                            break;
                        case 1:
                            io.sockets.in("room-" + roomnum).emit('createDaily', {});
                            break;
                        case 2:
                            io.sockets.in("room-" + roomnum).emit('createVimeo', {});
                            break;
                        case 3:
                            io.sockets.in("room-" + roomnum).emit('createHTML5', {});
                            break;
                        default:
                            console.log("Error invalid player id")
                    }

                    // This changes the room variable to the player id
                    io.sockets.adapter.rooms['room-' + roomnum].currPlayer = playerId
                    // console.log(io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer)

                    // This syncs the host whenever the player changes
                    host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                    socket.broadcast.to(host).emit('getData')
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }

        })

        // Change video player
        socket.on('change single player', function(data) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    var playerId = data.playerId

                    switch (playerId) {
                        case 0:
                            socket.emit('createYoutube', {});
                            break;
                        case 1:
                            socket.emit('createDaily', {});
                            break;
                        case 2:
                            socket.emit('createVimeo', {});
                            break;
                        case 3:
                            socket.emit('createHTML5', {});
                            break;
                        default:
                            console.log("Error invalid player id")
                    }
                    // After changing the player, resync with the host
                    host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                    socket.broadcast.to(host).emit('getData')
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Send Message in chat
        socket.on('send message', function(data) {
            try {
                var encodedMsg = data.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                // console.log(data);
                io.sockets.in("room-" + socket.roomnum).emit('new message', {
                    msg: encodedMsg,
                    user: socket.username
                });
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        // New User
        socket.on('new user', function(data, callback) {
            try {
                callback(true);
                // Data is username
                var encodedUser = data.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                socket.username = encodedUser;
                //console.log(socket.username)
                users.push(socket.username);
                updateUsernames();
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        // Changes time for a specific socket
        socket.on('change time', function(data) {
            try {
                // console.log(data);
                var caller = data.id
                var time = data.time
                socket.broadcast.to(caller).emit('changeTime', {
                    time: time
                });
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        // This just calls the syncHost function
        socket.on('sync host', function(data) {
            try {


                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    //socket.broadcast.to(host).emit('syncVideoClient', { time: time, state: state, videoId: videoId });
                    var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                    // If not host, recall it on host
                    if (socket.id != host) {
                        socket.broadcast.to(host).emit('getData')
                    } else {
                        socket.emit('syncHost')
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Emits the player status
        socket.on('player status', function(data) {
            // console.log(data);
            console.log(data)
        });

        // Change host
        socket.on('change host', function(data) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    console.log(io.sockets.adapter.rooms['room-' + socket.roomnum])
                    var roomnum = data.room
                    var newHost = socket.id
                    var currHost = io.sockets.adapter.rooms['room-' + socket.roomnum].host

                    // If socket is already the host!
                    if (newHost != currHost) {
                        console.log("I want to be the host and my socket id is: " + newHost);
                        //console.log(io.sockets.adapter.rooms['room-' + socket.roomnum])

                        // Broadcast to current host and set false
                        socket.broadcast.to(currHost).emit('unSetHost')
                        // Reset host
                        io.sockets.adapter.rooms['room-' + socket.roomnum].host = newHost
                        // Broadcast to new host and set true
                        socket.emit('setHost')

                        io.sockets.adapter.rooms['room-' + socket.roomnum].hostName = socket.username
                        // Update host label in all sockets
                        io.sockets.in("room-" + roomnum).emit('changeHostLabel', {
                            username: socket.username
                        })
                        // Notify alert
                        socket.emit('notify alerts', {
                            alert: 1,
                            user: socket.username
                        })
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Get host data
        socket.on('get host data', function(data) {
            try {
                if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                    var roomnum = data.room
                    var host = io.sockets.adapter.rooms['room-' + roomnum].host

                    // Broadcast to current host and set false
                    // Call back not supported when broadcasting

                    // Checks if it has the data, if not get the data and recursively call again
                    if (data.currTime === undefined) {
                        // Saves the original caller so the host can send back the data
                        var caller = socket.id
                        socket.broadcast.to(host).emit('getPlayerData', {
                            room: roomnum,
                            caller: caller
                        })
                    } else {
                        var caller = data.caller
                        // Call necessary function on the original caller
                        socket.broadcast.to(caller).emit('compareHost', data);
                    }
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }

        })

        // Calls notify functions
        socket.on('notify alerts', function(data) {
            try {
                var alert = data.alert
                console.log("entered notify alerts")
                var encodedUser = ""
                if (data.user) {
                    encodedUser = data.user.replace(/</g, "&lt;").replace(/>/g, "&gt;")
                }

                switch (alert) {
                    // Enqueue alert
                    case 0:
                        var encodedTitle = ""
                        if (data.title) {
                            encodedTitle = data.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")
                        }
                        io.sockets.in("room-" + socket.roomnum).emit('enqueueNotify', {
                            user: encodedUser,
                            title: encodedTitle
                        })
                        break;
                        // Host Change Alert
                    case 1:
                        io.sockets.in("room-" + socket.roomnum).emit('changeHostNotify', {
                            user: encodedUser
                        })
                        break;
                        // Empty Queue Alert
                    case 2:
                        io.sockets.in("room-" + socket.roomnum).emit('emptyQueueNotify', {
                            user: encodedUser
                        })
                        break;
                        // Beta Message Alert
                    case 3:
                        console.log("yoyoyoyoyo")
                        io.sockets.in("room-" + socket.roomnum).emit('betaNotify', {})
                        break;
                    default:
                        console.log("Error alert id")
                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        })

        // Play video
        socket.on('free for all', function() {
            try {
                var host = io.sockets.adapter.rooms['room-' + socket.roomnum].host
                if (socket.id === host) {
                    if (io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll) {
                        //disable it
                        io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll = false;
                        io.sockets.in("room-" + socket.roomnum).emit('disableFreeForAll');
                    } else {
                        //enable it
                        io.sockets.adapter.rooms['room-' + socket.roomnum].freeForAll = true;
                        io.sockets.in("room-" + socket.roomnum).emit('enableFreeForAll');
                    }

                }
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });

        //------------------------------------------------------------------------------
        // Async get current time
        socket.on('auto sync', function(data) {
            try {
                var async = require("async");
                var http = require("http");

                //Delay of 5 seconds
                var delay = 5000;

                async.forever(

                    function(next) {
                        // Continuously update stream with data
                        //var time = io.sockets.in("room-"+1).emit('getTime', {});
                        //Store data in database
                        //console.log(time);

                        console.log("i am auto syncing")
                        socket.emit('syncHost');

                        //Repeat after the delay
                        setTimeout(function() {
                            next();
                        }, delay)
                    },
                    function(err) {
                        console.error(err);
                    }
                );
            } catch (e) {
                //log error
                var dataToLog = [
                    'ExceptionLogs',
                    'Exception: ' + e.message + '\n'
                ]
                log(dataToLog)
            }
        });


        // Some update functions --------------------------------------------------
        // Update all users
        function updateUsernames() {
            // io.sockets.emit('get users', users);
            // console.log(users)
        }

        // Update the room usernames
        function updateRoomUsers(roomnum) {
            if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                var roomUsers = io.sockets.adapter.rooms['room-' + socket.roomnum].users
                io.sockets.in("room-" + roomnum).emit('get users', roomUsers)
            }
        }

        // Update the playlist/queue
        function updateQueueVideos() {
            if (io.sockets.adapter.rooms['room-' + socket.roomnum] !== undefined) {
                var vidlist = io.sockets.adapter.rooms['room-' + socket.roomnum].queue
                var currPlayer = io.sockets.adapter.rooms['room-' + socket.roomnum].currPlayer
                io.sockets.in("room-" + socket.roomnum).emit('get vidlist', {
                    vidlist: vidlist,
                    currPlayer: currPlayer,
                })
            }
        }
    } catch (e) {
        //log error
        var dataToLog = [
            'ExceptionLogs',
            'Exception: ' + e.message + '\n'
        ]
        log(dataToLog)
    }

})

setInterval(() => {}, 1 << 30);

async function log(data) {
    if (logToFile || logToSql || logToDiscordWebHook) {
        let date = new Date();
        var dateString = date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear();
        var time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

        var username = data[1].substring(0, data[1].indexOf(":"));
        var logData = data[1].substring((data[1].indexOf(":") + 2), data[1].indexOf("\n"));
        var dateTime = dateString + "-" + time;

        //file logging
        if (logToFile) {
            fs.appendFile('public/logs/' + dateString + '-' + data[0] + ".txt", "[" + time + "] " + data[1], function(err) {
                if (err) {
                    console.log("Failed to save data...");
                }
            });
        }

        //if we have discord webhook logging enabled
        if (logToDiscordWebHook) {
            var msg = new webhook.MessageBuilder()
                .setName(data[0])
                .setColor("#aabbcc")
                .setText(data[0])
                .addField("Username:", username)
                .addField("Log message:", logData)
                .addField("Time", dateTime)
                .setTime();

            switch (data[0]) {
                case "connectionLogs":
                    msg.setColor("#03fc03");
                    break;
                case "videoLogs":
                    msg.setColor("#03e8fc");
                    break;
                case "ExceptionLogs":
                    msg.setColor("#ff1100");
                    break;

            }

            discordHook.send(msg);

        }

        //if we have a sql db - write to it
        if (sqlConnected) {
            var sqlQuery = "INSERT INTO " + data[0] + " (username, time, log) VALUES (?, ?, ?)";
            sqlConnection.query(sqlQuery,
                [
                    username,
                    dateTime,
                    logData
                ],
                function(err, result) {
                    if (err) {
                        console.log("Failed to insert log -- " + username + " : " + logData + "\n");
                        console.log("Error: " + err + "\n");
                    }
                });
        }
    }
}