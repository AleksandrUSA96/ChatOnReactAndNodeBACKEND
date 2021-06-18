//For start server need inter next command: 'npm start'
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
    app.options('*', (req, res) => {
        res.header('Access-Control-Allow-Methods', 'GET, PATCH, PUT, POST, DELETE, OPTIONS');
        res.send();
    });
});

const roomsStore = new Map();

app.post('/entrance', (req, res) => {
    const {roomId} = req.body;
    if (!roomsStore.has(roomId)) roomsStore.set(roomId, new Map([
        ['users', new Map()],
        ['messages', []]
    ]));
    res.status(200).send();
})

io.on('connection', (socket) => {
    socket.on('ROOM:AUTH', ([name, roomId]) => {
        socket.join(roomId);
        roomsStore.get(roomId).get('users').set(socket.id, name);
        roomsStore.forEach((room, key) => {
            if (key !== roomId) {
                room.get('users').delete(socket.id);
                socket.leave(key);
            }
            if (!room.get('users').size) roomsStore.delete(key);
        })

        io.emit('ROOM:SET_ROOMS', getRoomList());
        socket.emit('ROOM:SET_MESSAGES', roomsStore.get(roomId).get('messages'));
    })

    socket.on('ROOM:SET_ROOMS', () => {
        socket.emit('ROOM:SET_ROOMS', getRoomList());
    });

    socket.on('MESSAGE', ([messageInfo, roomId]) => {
        roomsStore.get(roomId).get('messages').push([messageInfo, socket.id]);
        socket.broadcast.to(roomId).emit('MESSAGE', [messageInfo, socket.id]);
    })

    socket.on('disconnect', () => {
        roomsStore.forEach((room, key) => {
            room.get('users').delete(socket.id);
            if (!room.get('users').size) roomsStore.delete(key);
        });
        socket.broadcast.emit('ROOM:SET_ROOMS', getRoomList());
    })
});

server.listen(PORT, () => {
    console.log('listening on *:' + PORT);
});

const getRoomList = () => {
    const roomsList = []
    roomsStore.forEach((value, key) => {
        roomsList.push({name: key, val: [...value.get('users').values()]})
    });
    return roomsList;
}