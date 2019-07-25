const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const cors = require('cors');
const nunjucks = require('nunjucks');
const session = require('express-session')
const nedbStore = require('nedb-session-store')( session );
const app = express();

let config = require('./config.js');

let userDB = new Datastore({filename: 'users'});
userDB.loadDatabase();

let authorDB = new Datastore({filename: 'authors'});
authorDB.loadDatabase();

nunjucks.configure(__dirname + '/src/views', {
    autoescape: true,
    cache: false,
    express: app
});

app.use(bodyParser.urlencoded({
    extended: true
 }));

app.use(bodyParser.json());
app.use(
    session({
        secret: config.token,
        resave: false,
        saveUninitialized: true,
        store: new nedbStore({filename:'sessions'})
      }),
    cors(),
    bodyParser(),
    express.static(__dirname + '/src'),
    function(req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');
        next();
    }
);

const router = express.Router();

function randomInteger(min, max) {
    var rand = min - 0.5 + Math.random() * (max - min + 1)
    rand = Math.round(rand);
    return rand;
}

//// routing

router.get('/reg', async (req, res) => {
    res.render('reg.html')
})
router.post('/reg', async (req, res) => {
    userDB.find({login: req.body.login}, async (err, test) => {
        if (req.body.login && (req.body.pass == req.body.pass1) && test.length==0) {
            await userDB.insert({
                login: req.body.login,
                pass: req.body.pass,
                balance: 0,
                ops: []
            })
            userDB.find({login: req.body.login} , (err2, accaunt) => {
                accaunt = accaunt[0]
                req.session.user = {id: accaunt._id, login: accaunt.login, session: req.sessionID}
                req.session.save();
                res.redirect('/wallet')
            })
        } else {
            res.redirect('/main/regerr')
        }
    })
})

router.post('/dopreg', async (req, res) => {
    let errCode = 1;
    let errText = '';
    let emailValid = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
    if (req.body.pass.length < 6 || !emailValid.test(req.body.email) || !req.body.company || !req.body.position) {
        res.json({errCode:1, errText: 'Некорректно заполнены поля'});
    } else
    authorDB.find({pietetId: Number(req.body.id)}, async (err, author) => {
        if (author[0]) {
            console.log(author[0])
            console.log(req.body)
            console.log(!author[0].email, !author[0].pass, !author[0].email && !author[0].pass)
            if (author[0].pietetPass.toString() === req.body.passId.toString() &&
            !author[0].email && !author[0].pass
            ) {
                await new Promise((rsp,rj) => {
                    authorDB.find({email: req.body.email}, async (err, _author) => {
                        if (_author.length === 0) {
                            errCode = 0;
                            await authorDB.update({pietetId: author[0].pietetId},{
                                pietetId: author[0].pietetId,
                                pietetPass: author[0].pietetPass,
                                company: author[0].company,
                                company2: req.body.company,
                                position: req.body.position,
                                author: author[0].author,
                                email: req.body.email,
                                pass: req.body.pass,
                            }, {})
                        } else
                        {
                            console.log('vo')
                            console.log(_author)
                            errCode = 1;
                            errText = 'Такой email уже зарегистрирован';
                        }
                        rsp();
                    });
                })
 
            }
            else if (author[0].email || author[0].pass) {
                errCode = 1;
                errText = 'Вы уже зарегистрированы';
            }
        }
        res.json({errCode, errText});
    });
});

router.post('/auth', async (req, res) => {
    let errCode = 1;
    let errText = '';
    authorDB.find({email: req.body.email}, async (err, author) => {
        if (author[0]) {
            if (author[0].pass.toString() === req.body.pass.toString()) {
                res.json({id: author[0].pietetId, pass: author[0].pietetPass, errCode: 0});
            }
            else
                res.json({errCode, errText: 'Неверный пароль!'})
        }
        else
            res.json({errCode, errText: 'Пользователь не найден!'})
    });
});

router.post('/comment', async (req, res) => {
    let errCode = 1;
    let errText = '';
    authorDB.find({pietetId: Number(req.body.acc.pietetId)}, async (err, author) => {
        if (author[0]) {
            if (author[0].pietetPass.toString() === req.body.acc.pietetPass.toString() &&
                author[0].email && author[0].pass
                ) {
                await new Promise((resp, rej) => {
                    userDB.find({userId: req.body.id}, async (err, acc) => {
                    if (acc[0]){
                        let flag = false
                        acc[0].estimating.map(estimate => {
                            if (estimate.id == req.body.acc.pietetId) {
                                flag = true;
                            }
                        })

                        new_count = acc[0].count;
                        if (!flag) {
                            ++new_count;
                            acc[0].estimating.push({date: new Date(), id: req.body.acc.pietetId, choice: req.body.choice, comment: req.body.comment});
                        }
                        else {
                            --new_count;
                            acc[0].estimating.splice(acc[0].estimating.findIndex(item=> {
                                return item.id === req.body.acc.pietetId
                            }), 1)
                        }
        
                        errCode = 0;
                        await userDB.update({userId: acc[0].userId},{
                            userId: acc[0].userId,
                            count: new_count,
                            estimating: acc[0].estimating
                        }, {})
                    }
                    else {
                        errCode = 0;
                        await userDB.insert({
                            userId: req.body.id,
                            count: 1,
                            estimating: [{id: req.body.acc.pietetId, choice: req.body.choice, comment: req.body.comment, date: new Date()}]
                        })
                    }
                    resp();
                    });
                })        
            }
            else {
                errText = 'Для отправки отзыва необходимо авторизоваться.';
            }
        } else {
            errText = 'Для отправки отзыва необходимо зарегистрироваться в расширении.';
        }
        res.json({errCode, errText})
    })
})

router.get('/comm/:id', async (req, res) => {
    userDB.find({userId: req.params.id}, (err, acc) => {
        if (acc[0]) {
            let comments = [];
            for (let i=0; i<acc[0].estimating.length; i++) {
                comments.push({
                    date: acc[0].estimating[i].date.toLocaleString("ru-RU", {day: 'numeric', month: 'numeric', year:'numeric'}),
                    cause: (() => {
                        let answer = '';
                        switch(acc[0].estimating[i].choice) {
                            case '1': answer = 'Не пришел на интервью'; break;
                            case '3': answer = 'Неадекватное поведение'; break;
                            case '4': answer = 'Другое'; break;
                        }
                        return answer;
                    })(),
                    text: (acc[0].estimating[i].comment === '') ? 'Без комментариев' : acc[0].estimating[i].comment,
                    id: acc[0].estimating[i].id,
                });
            }
            res.render('comment.html', {resumeId: acc[0].userId, api: config.url ,comments});
        } else {
            res.render('comment.html', {resumeId: req.params.id, api: config.url ,comments:[]})
        }
    });
})

router.get('/comment', async (req, res) => {
    userDB.find({userId: req.query.id}, (err, acc) => {
        if (acc[0]) {
            let flag = false;
            acc[0].estimating.map( value => {
                if (value.id == req.query.author)
                    flag = true;
            })
            res.json({count: acc[0].count, liked: flag})
        }
        else {
            res.json({count: 0, liked: false})
        }
    })
})

router.get('/newuser/:company/:author', (req, res) => {

    authorDB.find({}, (err, items)=> {
        let pietetId = items.length,
            pietetPass = randomInteger(1000000,9999999);
        authorDB.insert({
            pietetId: pietetId,
            pietetPass: pietetPass,
            company: req.params.company,
            author: req.params.author,
            company2: req.body.company,
            position: req.body.position,
            email: req.body.email,
            pass: req.body.pass,
            email: "",
            pass: "",

        })
        res.json({
            pietetId: pietetId,
            pietetPass: pietetPass
        })
    })
})

router.get('/info/:version', (req, res) => {
    if (req.params.version==='0' || req.params.version === 0) {
        res.json({
            status: 0,
            version: config.version
        })
    } else if (req.params.version == config.version) {
        res.json({
            status: 0,
            text: 'У вас последняя версия расширения'
        })
    } else {
        res.json({
            status: 1,
            text: 'Вышло обновление расширение HH Pietet.\nДля корректной работы, обновите расширение по ссылке http://hrhonor.ru/upd'
        })
    }
})

router.get('/user/:id', async (req, res) => {
    let results = [];
    userDB.find({}, (err, users) => {
        for (let i=0; i<users.length; i++) {
            for (let j=0; j<users[i].estimating.length; j++) {
                if (users[i].estimating[j].id === req.params.id) {
                    results.push({
                        date: users[i].estimating[j].date.toLocaleString("ru-RU", {day: 'numeric', month: 'numeric', year:'numeric'}),
                        cause: (() => {
                            let answer = '';
                            switch(users[i].estimating[j].choice) {
                                case '1': answer = 'Не пришел на интервью'; break;
                                case '3': answer = 'Неадекватное поведение'; break;
                                case '4': answer = 'Другое'; break;
                            }
                            return answer;
                        })(),
                        text: (users[i].estimating[j].comment === '') ? 'Без комментариев' : users[i].estimating[j].comment,
                        id: users[i].userId,
                    });
                }
            }
        }
        res.render('users.html', {resumeId: req.params.id, api: config.url ,comments: results})
    });
})

router.get('/info', (req, res) =>  {
    res.render(`info.html`)
});

app.use(router);
app.listen(require('./config.js').port);

if (config.prod) {
    let server = require('https').createServer({
        key: fs.readFileSync(path.resolve(__dirname, 'ssl/server.key')),
        cert: fs.readFileSync(path.resolve(__dirname, 'ssl/server.crt'))
    }, app);
    server.listen(require('./config.js').port2);
}


console.log(`Running at Port ${config.port}`);