const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const session = require('express-session');
const app = express();
const PORT = 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

function readUsers() {
    try {
        return JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync('data/users.json', JSON.stringify(users, null, 2));
}

// 사용자 목록 불러오기
app.get('/users', (req, res) => {
    res.json(readUsers());
});

app.post('/update-user', (req, res) => {
    const { number, group, nickname, password, age } = req.body;
    let users = readUsers();
    let userIndex = users.findIndex(user => user.number === parseInt(number));
    if (userIndex !== -1) {
        users[userIndex] = { number: parseInt(number), group, nickname, password, age: parseInt(age) };
        writeUsers(users);
        res.json({ success: true, message: 'User updated successfully' });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

app.post('/register', (req, res) => {
    const { group, nickname, password } = req.body;
    let users = readUsers();
    let user = users.find(u => u.nickname === nickname);
    if (user) {
        if (user.password === password && user.group === group) {
            req.session.user = user;
            res.redirect('/main.html');
        } else {
            res.send('Login failed: Incorrect password or group');
        }
    } else {
        user = {
            number: users.length + 1,
            group: group,
            nickname: nickname,
            password: password,
            age: 10
        };
        users.push(user);
        writeUsers(users);
        req.session.user = user;
        res.redirect('/main.html');
    }
});

// 세션 정보를 클라이언트에 제공
app.get('/session-info', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: "User not logged in" });
    }
});

app.post('/update-age', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Please login first.');
    }
    let users = readUsers();
    let user = users.find(u => u.nickname === req.session.user.nickname);
    user.age = parseInt(req.body.age, 10);
    writeUsers(users);
    res.redirect('/main.html');
});

// 순위 데이터 제공
app.get('/rankings', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }
    let users = readUsers();
    // 그룹 순위 계산
    let groupStats = users.reduce((acc, user) => {
        if (!acc[user.group]) {
            acc[user.group] = { totalAge: 0, members: 0 };
        }
        acc[user.group].totalAge += user.age;
        acc[user.group].members++;
        return acc;
    }, {});
    let groupRankings = Object.keys(groupStats).map(group => ({
        groupName: group,
        totalAge: groupStats[group].totalAge,
        membersCount: groupStats[group].members
    })).sort((a, b) => b.totalAge - a.totalAge);

    // 개인 순위 계산
    let individualRankings = users.map(user => ({
        groupName: user.group,
        nickname: user.nickname.charAt(0) + '*'.repeat(user.nickname.length - 1),
        age: user.age
    })).sort((a, b) => b.age - a.age).slice(0, 20);

    res.json({ groupRankings, individualRankings });
});



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});