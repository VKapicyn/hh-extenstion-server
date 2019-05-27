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
        console.log(test)
        if (req.body.login && (req.body.pass == req.body.pass1) && test.length==0) {
            await userDB.insert({
                login: req.body.login,
                pass: req.body.pass,
                balance: 0,
                ops: []
            })
            userDB.find({login: req.body.login} , (err2, accaunt) => {
                console.log(accaunt)
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

router.post('/comment', async (req, res) => {
    //TODO: проверить право на отправку по id
    //TODO: сохранять инфу о получателе
    console.log(req.body.acc)
    console.log(req.body.id+'POST')
    authorDB.find({pietetId: req.body.acc.pietetId}, async (err, author) => {
        if (author[0]) {
            if (author[0].pietetPass == req.body.acc.pietetPass) {
                await userDB.find({userId: req.body.id}, async (err, acc) => {
                    if (acc[0]){
                        let flag = false
                        acc[0].estimating.map(estimate => {
                            if (estimate == req.body.acc.pietetId) {
                                flag = true;
                            }
                        })
        
                        new_count = acc[0].count;
                        if (!flag) {
                            ++new_count;
                            acc[0].estimating.push(req.body.acc.pietetId);
                        }
                        else {
                            --new_count;
                            acc[0].estimating.splice(acc[0].estimating.indexOf(req.body.acc.pietetId), 1)
                        }
        
                        await userDB.update({userId: acc[0].userId},{
                            userId: acc[0].userId,
                            count: new_count,
                            estimating: acc[0].estimating
                        }, {})
                    }
                    else {
                        await userDB.insert({
                            userId: req.body.id,
                            count: 1,
                            estimating: [req.body.acc.pietetId]
                        })
                    }
                })        
            }
        }
        res.send('ok')
    })
})

router.get('/comment', async (req, res) => {
    console.log(req.query.id+' GET')
    console.log(req.query.fio)
    //TODO: получение инфы, "лайкал" ли этот юзер соискателя
    userDB.find({userId: req.query.id}, (err, acc) => {
        if (acc[0]) {
            let flag = false;
            acc[0].estimating.map( value => {
                if (value == req.query.author)
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
    //TODO: протестить
    authorDB.find({}, (err, items)=> {
        let pietetId = items.length,
            pietetPass = randomInteger(1000000,9999999);
        authorDB.insert({
            pietetId: pietetId,
            pietetPass: pietetPass,
            company: req.params.company,
            author: req.params.author
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

app.use(router);
app.listen(require('./config.js').port);

/*let server = require('https').createServer({
    key: fs.readFileSync(path.resolve(__dirname, 'ssl/server.key')),
    cert: fs.readFileSync(path.resolve(__dirname, 'ssl/server.crt'))
}, app);
server.listen(require('./config.js').port2);*/

console.log(`Running at Port ${config.port}`);