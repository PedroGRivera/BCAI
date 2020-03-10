var inquirer = require('inquirer');
var Web3 = require('web3');
var fs = require('fs');
const prompts = require('prompts');
var figlet = require('figlet');
const chalk = require('chalk');
var path = require('path');
const {exec} = require('child_process');
const {execSync} = require('child_process');
const Folder = './';
var publicIp = require("public-ip");
var hex2ascii= require("hex2ascii")
var express = require('express');
var Table = require('cli-table');

require('events').EventEmitter.prototype._maxListeners = 100;

var now = new Date();
var date = "";
var requestAssignedFlag = 0;
var validationAssignedFlag = 0;
//position 38 or 37
var validationCounter = 0;
var taskCounter = 0;
var NetworkID = 3;
var serverPort = 5000;
var ClientPort = 5000;
var ip         = undefined;
var ip4        = undefined;
var ip6        = undefined;
var mode       = undefined;
var requestAddr= undefined;
var filePath = undefined;
var requestIP = undefined;
var buffer = [];
var webpageUp = 0;
var executing = false;
var finished  = false;
var canRate = false;
var pos = 0;
var ratings = [];
var rateProvs = [];
var validationSelectFlag = false;
var ratingsTable = new Table({
    chars: { 'top': '═' , 'top-mid': '╤' , 'top-left': '╔' , 'top-right': '╗'
           , 'bottom': '═' , 'bottom-mid': '╧' , 'bottom-left': '╚' , 'bottom-right': '╝'
           , 'left': '║' , 'left-mid': '╟' , 'mid': '─' , 'mid-mid': '┼'
           , 'right': '║' , 'right-mid': '╢' , 'middle': '│' }
});
var valEntCount = 0;
///////////////////////////////////////////////////////////////////Get IP///////////////////////////////////////////////////////////////////////////////////

fs.open('./stat.txt', 'w', function(err){
    if (err) throw err;
})

fs.open('./log.txt', 'w', function(err){
    if (err) throw err;
})

var getIp = (async() => {
    await publicIp.v4().then(val => {ip4 = val});
    await publicIp.v6().then(val => {ip6 = val});
})
  
  //this calls the IP generating file and then depending on the option that is given it will create the server
  //since the IP is necessary for the creation of the socket.io server all the server section resides in this .then call
getIp().then(() => {
    //allow for manual choice (defaults to IPv4)
    if(process.argv[2] !== undefined && process.argv[2] === "-def" && process.argv[3] !== undefined ){
        ip = process.argv[3] + ":" + serverPort;
    }
    else if(process.argv[2] !== undefined && process.argv[2] === "-4"){
      ip = ip4 + ":" + serverPort;
    }

    else if(process.argv[2] !== undefined && process.argv[2] === "-6"){
      ip = "[" + ip6 + "]:" + serverPort;console.log(chalk.cyan("Thank you for using iChain worker CLI! The Peer to Peer Blockchain Machine \nLearning Application. Select 'start providing' to get started or 'help' \nto get more information about the application.\n"))

    }
    else{
      ip = ip4 + ":5000";
    }
    //console.log(ip);
});

var UTCFileArray = [];
var UTCfile;
var userAddress;
var userAddresses = [];

//Ethereum subscribe variables
var RequestStartTime = 0

fs.readdir(Folder, (err, files) => {
    files.forEach(file => {
        if(file[0] === 'U' && file[1] === 'T' && file[2] === 'C')
        {
            UTCFileArray.push(file);
            userAddresses.push("0x" + file.slice(37, file.length));
        }
    })

})


var ws = new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws/v3/aa544d081b53485fb0fa8df2c9a8437e')
web3 = new Web3(ws);
var TaskContract = require('../../bcai_deploy/client/src/contracts/TaskContract.json');
var abi = TaskContract.abi;
var addr = TaskContract.networks[NetworkID].address;       //align to const ID defination on top
const myContract = new web3.eth.Contract(abi, addr);

//test user account addr : 0x458C5617e4f549578E181F12dA8f840889E3C0A8 and password : localtest
var prov = 0;
var decryptedAccount = "";

questions = {
    type : 'list',
    name : 'whatToDo',
    message: 'What would you like to do?',
    choices : ['start request', 'show pools', 'create new address','show addresses',  'help', 'show provider ratings', 'quit'],
};

questions1 = {
    type : 'list',
    name : 'whatToDo1',
    message : 'What would you like to do?',
    choices : ['stop request', 'update request', 'show pools', 'finalize request', 'show provider rating', 'choose provider', 'choose validator', 'quit'],
};

clearStat();
clearLog();
fs.appendFile('./log.txt', String(Date(Date.now())), function(err){
    if(err) throw err;
})
console.log(chalk.cyan(" _  ____ _           _       \n(_)/ ___| |__   __ _(_)_ __  \n| | |   | '_ \\ / _` | | '_ \\ \n| | |___| | | | (_| | | | | |\n|_|\\____|_| |_|\\__,_|_|_| |_|\n\n"))
console.log(chalk.cyan("Thank you for using iChain user CLI! The Peer to Peer Blockchain Machine \nLearning Application. Select 'start request' to get started or 'help' \nto get more information about the application.\n"))


process.on('SIGINT', async () => {
    try{
        console.log("\n");
        const response = await prompts({
        type: 'text',
        name: 'val',
        message: 'You must choose the "quit" option before exiting appliation. Type "quit" here if you would like to quit or "back" to go to main menu...\n'
        });
        if(response.val.toLowerCase() == "quit")
        {
            if(prov == 1)
            {
                stopTask(questions.choices[5]);
            }
            else
            {
                process.exit(-1);
            }
        }
        if(response.val.toLowerCase() == "back"){
            askUser();
        }
    }
    catch(err){
        console.log("\n", chalk.red("Error: you didn't choose 'quit' or 'back' so we are quitting the application for you..."), "\n");
        if(prov == 1)
        {
            stopTask(questions.choices[5]);
        }
        else
        {
            process.exit(-1);
        }
    }
});

setRatingVars();
cliOrSite();

function cliOrSite(){
    inquirer.prompt([
        {
            type: 'list',
            name: 'interface',
            choices: ['Continue with CLI', 'Open Site'],
            message: 'Choose an interface'
        }
    ])
    .then (answers => {
        if(answers.interface == 'Continue with CLI'){
            console.log("\n\n");
            askUser();
        }
        else{
            listenWebsite();
        }
    })
}


function setRatingVars(){
    ratingsTable = new Table({
        chars: { 'top': '═' , 'top-mid': '╤' , 'top-left': '╔' , 'top-right': '╗'
               , 'bottom': '═' , 'bottom-mid': '╧' , 'bottom-left': '╚' , 'bottom-right': '╝'
               , 'left': '║' , 'left-mid': '╟' , 'mid': '─' , 'mid-mid': '┼'
               , 'right': '║' , 'right-mid': '╢' , 'middle': '│' }
    });
    myContract.methods.getProviderPool().call().then(function(provPool){
        return provPool
		//return provPool;
    })
    .then((provPool) => {
        ratingsTable.push(["Rating", "Provider"])
        provPool.forEach(prov =>{
            myContract.methods.getAvgRating(prov).call().then(function(rating){
                pos+=1;
                ratings.length = 0;
                rateProvs.length = 0;
                ratings.push(rating);
                rateProvs.push(prov);

                return [rating, pos, prov];
            })
            .then((arr) => {
                //console.log("\nThe rating is ", rating, " for provider", prov, "\n")
                ratingsTable.push([arr[0].toString(), arr[2].toString()]);
                return arr[1];
            })
        })
    })
    //.then(() => askUser())
    .catch((err) => console.log(err));

}



//////////////////////////////////////////////////////CLI FUNCTIONS//////////////////////////////////////////////////////////////////

//Asks for reputation rating

function validateRating(rating){
    return rating >= 1 && rating <= 100;
}

function giveRating(){
    canRate = false;
    inquirer.prompt([
        {
            type: 'list',
            name: 'askToRate',
            choices: ['Yes', 'No'],
            message: 'Would you like to give a rating for your provider?'
        }
    ])
    .then (answers =>{
        if(answers.askToRate == 'Yes'){
            console.log(chalk.cyan("\nYou have chosen to give a rating\n"));
            //finalize request function

            inquirer.prompt([
                {
                    type: 'number',
                    name: 'rating',
                    message: 'Give a rating between 1 and 100',
                    validate: validateRating 
                }
            ])
            .then(answers =>{
                var ABIfinalizeRequest; //prepare abi for a function call
                ABIfinalizeRequest = myContract.methods.finalizeRequest(userAddress, true, answers.rating).encodeABI();
                const rawTransaction = {
                    "from": userAddress,
                    "to": addr,
                    "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                    "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                    "gas": 5000000,
                    "chainId": 3,
                    "data": ABIfinalizeRequest
                }

                decryptedAccount.signTransaction(rawTransaction)
                .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
                .then(receipt => {
                    //console.log(chalk.cyan("\n\nTransaction receipt: "), receipt)
                    console.log(chalk.cyan("\n\nYour rating has gone through...\n"))
                })
                .then(()=>{
                    askUser();
                })
            })
        }
        else{
            console.log(chalk.cyan("\nYou have elected to not give rating\n"));
            //go back to main menu
            var ABIfinalizeRequest; //prepare abi for a function call
            ABIfinalizeRequest = myContract.methods.finalizeRequest(userAddress, false, 0).encodeABI();
            const rawTransaction = {
                "from": userAddress,
                "to": addr,
                "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                "gas": 5000000,
                "chainId": 3,
                "data": ABIfinalizeRequest
            }

            decryptedAccount.signTransaction(rawTransaction)
            .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
            .then(receipt => {
                //console.log(chalk.cyan("\n\nTransaction receipt: "), receipt)
                console.log(chalk.cyan("\n\nYour request has gone through...\n"))
            })
            .then(()=>{
                askUser();
            })
        }
    })
}



function promptProviderChoices(){
    setRatingVars();
    var displayProvList = [];
    var displayString = "";
    for(var i = 0; i<rateProvs.length; i++){
        displayString = rateProvs[i] + "- Rating: " + ratings[i];
        displayProvList.push(displayString);
    }
    inquirer.prompt([
        {
            type: 'list',
            name: 'provChoice',
            choices: displayProvList,
            message: 'Choose provider:'
        }
    ])
    .then(choice => {
        console.log(chalk.cyan("\nYou have choosen ", choice.provChoice, " as your provider\n"));
        //address is chars 0-41
        var chooseProvAddr = choice.provChoice.slice(0, 42).toLowerCase();
        var ABIChooseProvider; //prepare abi for a function call
        ABIChooseProvider = myContract.methods.chooseProvider(chooseProvAddr).encodeABI();
        const rawTransaction = {
            "from": userAddress,
            "to": addr,
            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
            "gas": 5000000,
            "chainId": 3,
            "data": ABIChooseProvider
        }

        decryptedAccount.signTransaction(rawTransaction)
        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
        .then(receipt => {
            //console.log(chalk.cyan("\n\nTransaction receipt: "), receipt)
            console.log(chalk.cyan("\n\nYour request has been submitted... \n\n"));
            prov = 1;
        })
        .then(()=>{
            askUser();
        })
    })
    
    
}

function chooseValidator(){
    setRatingVars();
    var displayValidatorList = [];
    var displayString = "";
    for(var i = 0; i<rateProvs.length; i++){
        displayString = rateProvs[i] + "- Rating: " + ratings[i];
        displayValidatorList.push(displayString);
    }
    inquirer.prompt([
        {
            type: 'list',
            name: 'provChoice',
            choices: displayValidatorList,
            message: 'Choose validator:'
        }
    ])
    .then(choice => {
        console.log(chalk.cyan("\nYou have choosen ", choice.provChoice, " as your validator\n"));
        //address is chars 0-41
        var chooseProvAddr = choice.provChoice.slice(0, 42).toLowerCase();
        var ABIChooseProvider; //prepare abi for a function call
        ABIChooseProvider = myContract.methods.chooseProvider(chooseProvAddr).encodeABI();
        const rawTransaction = {
            "from": userAddress,
            "to": addr,
            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
            "gas": 5000000,
            "chainId": 3,
            "data": ABIChooseProvider
        }

        decryptedAccount.signTransaction(rawTransaction)
        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
        .then(receipt => {
            //console.log(chalk.cyan("\n\nTransaction receipt: "), receipt)
            console.log(chalk.cyan("\n\nYour request has been submitted for validation... \n\n"));
            prov = 1;
        })
        .then(()=>{
            validationSelectFlag = false;
            askUser();
        })
    })
}

//Gives the user a starting menu of choices
function askUser(){
    setRatingVars();

    if(canRate == true){
        giveRating();
    }
    if(validationSelectFlag == true){
        chooseValidator();
    }
    else{
        if(prov == 0)
            inquirer.prompt([questions]).then(answers => {choiceMade(answers.whatToDo)});
        else
            inquirer.prompt([questions1]).then(answers => {choiceMade(answers.whatToDo1)});
    }
}


function receiveResult(){
    /*if(!executing) {
        executing = true;
        exec('python3 execute.py ' + '0 ' + requestIP + ' none ' + ip4, (err,stdout,stderr)=>{

            if(err){
            console.log(err);
            return;
            }
        executing = false;
        console.log(stdout);
        
      });
    }*/

    fs.readFile('./stat.txt', function read(err, data){
        if (err) throw err;
        fileContent = data;
        //console.log(fileContent.toString('utf8'));
        if(fileContent.toString('utf8') === 'Ready')
        {
            clearStat();
            fs.appendFile('./stat.txt',  String(requestIP)+"\n"+"0", function (err){
                if (err) throw err;
            })   
        }
        else if(fileContent.toString('utf8') !== 'Executing' && finished === false){
            finished = true;
            clearStat();
            fs.appendFile('./stat.txt',  String(requestIP)+"\n"+"0", function (err){
                if (err) throw err;
            })   
        }
    })
}

function clearStat() {
    fs.truncate('./stat.txt', 0, function(err){
        if (err) throw err
    })
}


function clearLog(){
    fs.truncate('./log.txt', 0, function(err){
        if(err) throw err;
    })
}


/*function offer(){ 
    console.log("in offer function");
    if(!executing) {
        console.log("about to offer");
        executing = true;
        exec('python3 execute.py ' + '0 ' + requestIP + ' image.zip ' + ip4, (err,stdout,stderr)=>{
            if(err){

            console.log(err);
            return;
            }
        executing = false;
        console.log(stdout);
        
      });
    }
}
*/

//Takes choice made by prompt and controls where to go
function choiceMade(choice){

    if(prov == 0 && choice == questions.choices[0])
    {
        startTask();
    }
    else if(prov == 1 && choice == questions1.choices[0])
    {
        stopTask();
    }
    else if(choice == questions1.choices[1])
    {
        updateTask();
    }
    else if (choice == questions.choices[1] || choice == questions1.choices[2])
    {
        showPools();
    }
    else if(choice == questions1.choices[3]){
        giveRating();
    }
    else if(choice == questions.choices[2]){
        inquirer.prompt([
            {
                name : 'net',
                message: 'Enter MainNet or Ropsten: ',
            },
            {
                type: 'password',
                name : 'pass',
                message: 'Enter your password: ',
            },
            {
                type: 'password',
                name : 'passVeri',
                message: 'Enter your password: ',
            }
        ])
        .then(settings => {
            return [settings.net, settings.pass, settings.passVeri];
        })
        .then(newSettings => {
            var net   = newSettings[0];
            var pass  = newSettings[1];
            var passV = newSettings[2];
            
            if(pass === passV){
                if(net.toLowerCase() === 'mainnet'){
                    newAcc(1, pass)
                }
                else if(net.toLowerCase() === 'ropsten')
                    newAcc(0, pass)
                else  {
                    console.log("network entry not recognized");
                    askUser();
                }
            }
            if(pass !== passV){
                console.log("entered passwords do not match");
                askUser();
            }
        })
        .catch( err => {
            console.log("\n", chalk.red(err), "\n");
            askUser();
        });
    }
    else if(choice == questions.choices[3]){
        console.log('\n\n');                console.log("\n")

        for(var i = 0; i < userAddresses.length; i++){
            console.log(userAddresses[i]);
        }
        console.log('\n\n');
        askUser();
    }
    else if(choice == questions.choices[4])
    {
        //Need to update user help
        console.log(chalk.cyan("\niChain is an application that allows users to send machine learning tasks to"))
        console.log(chalk.cyan("providers who have high computational power to spare. To get started make sure"))
        console.log(chalk.cyan("your UTC keystore files are located in the same directory as this CLI. You can"))
        console.log(chalk.cyan("put multiple keystore files in the directory and will be allowed to choose from"))
        console.log(chalk.cyan("any of these accounts. Next select 'start request' and you will be asked to"))
        console.log(chalk.cyan("choose an account from the available accounts. You will then be asked to enter"))
        console.log(chalk.cyan("a password. This is the password associated with the selected keystore account."))
        console.log(chalk.cyan("You will thenbe asked to input your user settings that will be used to pair you "))
        console.log(chalk.cyan("with a provider. These can be changed at a later time once the request is "))
        console.log(chalk.cyan("submitted. After successfully entering all of the required input a new prompt "))
        console.log(chalk.cyan("will be displayed. By selecting 'update request' you can change the user input "))
        console.log(chalk.cyan("settings you entered earlier. 'Stop Request' will stop the current request."))
        console.log(chalk.cyan("Lastly, show pools will display the current state of the pools. Here you can "))
        console.log(chalk.cyan("check how many providers are available at a given moment. If it is taking a"))
        console.log(chalk.cyan("while for your request to be assigned you may want to consider changing your "))
        console.log(chalk.cyan("user input settings. Thank you for using iChain!\n\n"))
        askUser();
    }
    else if(choice == questions.choices[5] || choice == questions1.choices[4]){
        
        console.log("\n");
        console.log(ratingsTable.toString(), "\n\n")
        askUser();
    }
    else if(choice == questions1.choices[5]){
        promptProviderChoices();
    }
    else if(choice == questions1.choices[6]){
        if(validationSelectFlag == true){
            chooseValidator();
        }
        else{
            console.log(chalk.cyan("\nRequest has not been completed yet. You are unable to select a validator.\n"))
            askUser();
        }
    }
    else
    {
        if(prov == 1)
        {
            stopTask(choice);
        }
        else{
            process.exit(-1);
        }
    }
}

function newAcc(mainNet, pass){
    mess = '';
    fs.truncate('./pass.txt', 0, function(err){
        if (err) throw err
    })
    
    if(mainNet === 1)
        mess = 'geth account new --datadir . --password pass.txt';
    else
        mess = 'geth --testnet account new --datadir . --password pass.txt';

    fs.appendFile('./pass.txt',  String(pass)+"\n", function (err){
        if (err) throw err;
        exec(mess, (err, stdout, stderr) => {
            if (err) throw err;
            fs.truncate('./pass.txt', 0, function(err){
                if (err) throw err;
                exec('cp keystore/* .',(err,stdout,stderr)=>{
                    if(err) throw err;
                    exec('rm -r keystore',(err,stdout,stderr)=>{
                        if(err) throw err;
                        console.log("Congrats! New address constructed.")
                        console.log("To use add ether using your favorite exchange");
                        //add new keystore to the array
                        fs.readdir(Folder, (err, files) => {
                            userAddresses = []
                            files.forEach(file => {
                                if(file[0] === 'U' && file[1] === 'T' && file[2] === 'C' )
                                {
                                    UTCFileArray.push(file);
                                    userAddresses.push("0x" + file.slice(37, file.length));
                                }
                            })
                            askUser();
                        
                        })
                    });
                });
            })
        });
    })
}


function startTask(){
    console.log(chalk.cyan("\nPut your keystore file in the directory with the CLI ...\n\n"));
    if(userAddresses.length == 0)
    {
        console.log(chalk.red("Error: You have no keystore files in the directory of this CLI... to get started with an account put your keystore files in here..."), "\n")
        askUser();
    }
    else{
        inquirer.prompt([
            {
                type: 'list',
                name: 'userAddr',
                choices: userAddresses
            }
        ])
        .then(answers =>
            {
                for(i = 0; i<userAddresses.length; i++)
                {
                    if(answers.userAddr == userAddresses[i])
                    {
                        userAddress = userAddresses[i];
                        UTCfile = UTCFileArray[i];
                        break;
                    }
                }
                console.log(chalk.cyan("\nYou chose account: "+userAddress));
            }
        )
        .then( () => { 
        //Getting password from CLI
        if(decryptedAccount == "")
        {
            console.log("\n\n");
            
                inquirer.prompt([
                    {
                        type: 'password',
                        name: 'keystorePswd',
                        message: 'Enter your keystore file password: ',
                    },
                ])
                .then(answers => {return answers.keystorePswd})
                .then((password)=>{
                        //retrieving keystore file and decrypting with password
                        var keystore;
                        var contents = fs.readFileSync(UTCfile, 'utf8')
                        keystore = contents;
                        decryptedAccount = web3.eth.accounts.decrypt(keystore, password);
                        return decryptedAccount;
                    }
                )
                .then((decryptedAccount) =>{
                    console.log("\n");
                    inquirer.prompt([
                        {
                            name : 'mTime',
                            message: 'Enter max time: ',
                        },
                        {
                            name : 'mTarget',
                            message: 'Enter max target: ',
                        },
                        {
                            name : 'mPrice',
                            message: 'Enter min price: ',
                        },
                        {
                            name : 'filePath',
                            message: 'Enter file path: ',
                        }
                    ])
                    .then(settings => {
                        return [settings.mTime, settings.mTarget, settings.mPrice, settings.filePath];
                    })
                    .then(newSettings => {
                        console.log(chalk.cyan("\nWe are sending transaction to the blockchain... \n"));
                        var ABIstartRequest; //prepare abi for a function call
                        var maxTime = newSettings[0];
                        var maxTarget = newSettings[1];
                        var minPrice = newSettings[2];
                        filePath = newSettings[3];
                        if(filePath.slice(filePath.length-4, filePath.length) != ".zip")
                        {
                            console.log("\n", chalk.red("Error: You must provide the task as a .zip file... Select 'start request' to try again..."), "\n")
                            askUser();
                        }
                        else{
                            fs.open(filePath, 'r', (err, fd)=>{
                                //if(err){console.log(chalk.red("\n", chalk.red(err), "\n"));}
                                if(fd != undefined){
                                    function readChunk(){
                                        chunkSize = 10*1024*1024;
                                        var holdBuff = Buffer.alloc(chunkSize);
                                        fs.read(fd, holdBuff, 0, chunkSize, null, function(err, nread){
                                            //if(err){console.log("\n", chalk.red(err), "\n");}
                                            if(nread === 0){
                                                fs.close(fd, function(err){
                                                    //if(err){console.log("\n", chalk.red(err), "\n");}
                                                });
                                                return;
                                            }
                                            if(nread < chunkSize){
                                                try{
                                                    buffer.push(holdBuff.slice(0, nread));
                                                }
                                                catch(err){
                                                    console.log("You failed to select correct file path")
                                                }
                                            }
                                            else{
                                                buffer.push(holdBuff);
                                                //console.log(holdBuff)
                                                readChunk();
                                    
                                            }
                                        })
                                    } 
                                    readChunk();
                                    //console.log(buffer);
                                    ABIstartRequest = myContract.methods.startRequest(maxTime, maxTarget, minPrice, web3.utils.asciiToHex(ip)).encodeABI();
                                    //console.log(ABIstartRequest);
                                    const rawTransaction = {
                                        "from": userAddress,
                                        "to": addr,
                                        "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                                        "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                                        "gas": 5000000,
                                        "chainId": 3,
                                        "data": ABIstartRequest
                                    }
                                
                                    decryptedAccount.signTransaction(rawTransaction)
                                    .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
                                    .then(receipt => {
                                        //console.log(chalk.cyan("\n\nTransaction receipt: "));
                                        //console.log(receipt);
                                        console.log(chalk.cyan("\n\nYour request has been submitted... \n\n"));
                                        prov = 1;
                                    })
                                    .then(() => {//Pedro put your code here for start providing
                                        askUser();
                                        //call subscribe here

                                        try{
                                            web3.eth.subscribe('newBlockHeaders', (err, result) => {
                                                if(err) console.log(chalk.red(err), result);
                                                //console.log("================================================   <- updated! #", result.number);
                                                //console.log(result);
                                                //showPools();
                                                checkEvents();
                                            })
                                        }
                                        catch(error){
                                            alert(
                                                `Failed to load web3, accounts, or contract. Check console for details.`
                                            );
                                            console.log("\n", chalk.red(err), "\n");
                                        }


                                    })
                                    .catch(err => {
                                        if(String(err).slice(0, 41) == "Error: Returned error: insufficient funds")
                                        {
                                            console.log(chalk.red("\nError: This keystore account doesn't have enough Ether... Add funds or try a different account...\n"))
                                            askUser();
                                        }
                                        else{
                                            console.log(chalk.red("\nError: ", chalk.red(err), "\n"))
                                            askUser();
                                        }
                                    });
                                } 
                                else{
                                    console.log("\n", chalk.red("Error: No file found with file path..."), "\n")
                                    askUser();
                                }                 
                            });
                            
                        }
                    })
                    .catch( err => {
                        console.log("\n", chalk.red(err), "\n");
                        askUser();
                    });
                        
                })
                .catch(err =>{
                    if (String(err).slice(0, 28) == "Error: Key derivation failed")
                    {
                        console.log(chalk.red("\nError: You have entered the wrong keystore password... Please try again...\n"))
                        askUser();
                    }
                    else{
                        console.log("\nError: ", chalk.red(err), "\n");
                        askUser();
                    }
                })
            }
        else{
            console.log("\n");
            inquirer.prompt([
                {
                    name : 'mTime',
                    message: 'Enter max time: ',
                },
                {
                    name : 'mTarget',
                    message: 'Enter max target: ',
                },
                {
                    name : 'mPrice',
                    message: 'Enter min price: ',
                },
                {
                    name : 'filePath',
                    message: 'Enter file path: ',
                }
            ])
            .then(settings => {
                return [settings.mTime, settings.mTarget, settings.mPrice, settings.filePath];
            })
            .then(newSettings => {
                console.log(chalk.cyan("\nWe are sending transaction to the blockchain... \n"));
                var ABIstartRequest; //prepare abi for a function call
                var maxTime = newSettings[0];
                var maxTarget = newSettings[1];
                var minPrice = newSettings[2];
                filePath = newSettings[3];
                if(filePath.slice(filePath.length-4, filePath.length) != ".zip")
                {
                    console.log("\n", chalk.red("Error: You must provide the task as a .zip file... Select 'start request' to try again..."), "\n")
                    askUser();
                }
                else{
                    fs.open(filePath, 'r', (err, fd)=>{
                        //if(err){console.log(chalk.red("\n", chalk.red(err), "\n"));}
                        if(fd != undefined){
                            function readChunk(){
                                chunkSize = 10*1024*1024;
                                var holdBuff = Buffer.alloc(chunkSize);
                                fs.read(fd, holdBuff, 0, chunkSize, null, function(err, nread){
                                    //if(err){console.log("\n", chalk.red(err), "\n");}
                                    if(nread === 0){
                                        fs.close(fd, function(err){
                                            //if(err){console.log("\n", chalk.red(err), "\n");}
                                        });
                                        return;
                                    }
                                    if(nread < chunkSize){
                                        try{
                                            buffer.push(holdBuff.slice(0, nread));
                                        }
                                        catch(err){
                                            console.log("You failed to select correct file path")
                                        }
                                    }
                                    else{
                                        buffer.push(holdBuff);
                                        //console.log(holdBuff)
                                        readChunk();
                            
                                    }
                                })
                            } 
                            readChunk();
                            //console.log(buffer);
                            ABIstartRequest = myContract.methods.startRequest(maxTime, maxTarget, minPrice, web3.utils.asciiToHex(ip)).encodeABI();
                            //console.log(ABIstartRequest);
                            const rawTransaction = {
                                "from": userAddress,
                                "to": addr,
                                "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                                "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                                "gas": 5000000,
                                "chainId": 3,
                                "data": ABIstartRequest
                            }
                        
                            decryptedAccount.signTransaction(rawTransaction)
                            .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
                            .then(receipt => {
                                //console.log(chalk.cyan("\n\nTransaction receipt: "));
                                //console.log(receipt);
                                console.log(chalk.cyan("\n\nYour request has been submitted... \n\n"));
                                prov = 1;
                            })
                            .then(() => {//Pedro put your code here for start providing
                                askUser();
                                //call subscribe here

                                try{
                                    web3.eth.subscribe('newBlockHeaders', (err, result) => {
                                        if(err) console.log(chalk.red(err), result);
                                        //console.log("================================================   <- updated! #", result.number);
                                        //console.log(result);
                                        //showPools();
                                        checkEvents();
                                    })
                                }
                                catch(error){
                                    alert(
                                        `Failed to load web3, accounts, or contract. Check console for details.`
                                    );
                                    console.log("\n", chalk.red(err), "\n");
                                }


                            })
                            .catch(err => {
                                if(String(err).slice(0, 41) == "Error: Returned error: insufficient funds")
                                {
                                    console.log(chalk.red("\nError: This keystore account doesn't have enough Ether... Add funds or try a different account...\n"))
                                    askUser();
                                }
                                else{
                                    console.log(chalk.red("\nError: ", chalk.red(err), "\n"))
                                    askUser();
                                }
                            });
                        } 
                        else{
                            console.log("\n", chalk.red("Error: No file found with file path..."), "\n")
                            askUser();
                        }                 
                    });
                }
            })
            .catch( err => {
                console.log(chalk.red("\nError: ", chalk.red(err), "\n"))
                askUser();
            });
        
        }
    })
}

}




function stopTask(choice){
    if(choice == questions.choices[3] || choice == questions1.choices[3])
    {
        console.log(chalk.cyan("\nProvide keystore password to quit CLI... \n"));
    }
    else{
        console.log(chalk.cyan("\nProvide keystore password to stop request... \n"));
    }
    inquirer.prompt([
        {
            type: 'password',
            name: 'keystorePswd',
            message: 'Enter your keystore file password: ',
        },
    ])
    .then(answers => {return answers.keystorePswd})
    .then((password)=>{
            //retrieving keystore file and decrypting with password
            var filename;
            for(i = 0; i<userAddresses.length; i++)
            {
                if(userAddress == userAddresses[i])
                {
                    filename = UTCFileArray[i];
                    break;
                }
            }
            var keystore;
            var contents = fs.readFileSync(filename, 'utf8')
            keystore = contents;
            const decryptedAccount = web3.eth.accounts.decrypt(keystore, password);
            return decryptedAccount;
        }
    )
    .then((decryptedAccount) => {
        console.log(chalk.cyan("\nWe are sending transaction to the blockchain... \n"));
        var ABIstopRequest; //prepare abi for a function call
        ABIstopRequest = myContract.methods.stopRequest().encodeABI();
        const rawTransaction = {
            "from": userAddress,
            "to": addr,
            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
            "gas": 5000000,
            "chainId": 3,
            "data": ABIstopRequest
        }

        decryptedAccount.signTransaction(rawTransaction)
        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
        .then(receipt => {
            console.log(chalk.cyan("\n\nTransaction receipt: "), receipt)
            console.log(chalk.cyan("\n\nYou have taken down your request for address " + userAddress + "...\n"))
            prov = 0;
        })
        .then(() => {

            if(choice == questions.choices[3] || choice == questions1.choices[3])
            {
                console.log(chalk.cyan("Now quitting CLI ...\n\n"));
                decryptedAccount.signTransaction(rawTransaction)
                process.exit(-1);
            }
            else
            {
                askUser();
            }
        })
        .catch(err => {
            console.log("\n", chalk.red("Error: "), chalk.red(err), "\n")
            askUser();
        });
    })
    .catch( err => {
        if (String(err).slice(0, 28) == "Error: Key derivation failed")
        {
            console.log(chalk.red("\nError: You have entered the wrong keystore password... Please try again...\n"))
            askUser();
        }
        else{
            console.log("\n", chalk.red(err), "\n");
            askUser();
        }
    });
}


function updateTask(){
    console.log("\n");
        inquirer.prompt([
            {
                name : 'mTime',
                message: 'Enter new max time: ',
            },
            {
                name : 'mTarget',
                message: 'Enter new max target: ',
            },
            {
                name : 'mPrice',
                message: 'Enter new min price: ',
            },
            {
                name : 'filePath',
                message: 'Enter file path: ',
            }
        ])
        .then(settings => {
            return [settings.mTime, settings.mTarget, settings.mPrice, settings.filePath];
        })
        .then(newSettings => {
            console.log(chalk.cyan("\nWe are sending transaction to the blockchain... \n"));
            var ABIupdateProvider; //prepare abi for a function call
            var maxTime = newSettings[0];
            var maxTarget = newSettings[1];
            var minPrice = newSettings[2];
            var filePath = newSettings[3];
            if(filePath.slice(filePath.length-4, filePath.length) != ".zip")
            {
                console.log("\n", chalk.red("Error: You must provide the task as a .zip file... Select 'update request' to try again..."), "\n")
                askUser();
            }
            else{
                fs.open(filePath, 'r', (err, fd)=>{
                    //if(err){console.log(chalk.red("\n", chalk.red(err), "\n"));}
                    if(fd != undefined){
                        function readChunk(){
                            chunkSize = 10*1024*1024;
                            var holdBuff = Buffer.alloc(chunkSize);
                            fs.read(fd, holdBuff, 0, chunkSize, null, function(err, nread){
                                //if(err){console.log("\n", chalk.red(err), "\n");}
                                if(nread === 0){
                                    fs.close(fd, function(err){
                                        //if(err){console.log("\n", chalk.red(err), "\n");}
                                    });
                                    return;
                                }
                                if(nread < chunkSize){
                                    try{
                                        buffer.push(holdBuff.slice(0, nread));
                                    }
                                    catch(err){
                                        console.log("You failed to select correct file path")
                                    }
                                }
                                else{
                                    buffer.push(holdBuff);
                                    //console.log(holdBuff)
                                    readChunk();
        
                                }
                            })
                        }     
                        readChunk();
                        ABIupdateProvider = myContract.methods.updateRequest(maxTime, maxTarget, minPrice).encodeABI();
                        //console.log(ABIstartRequest);
                        const rawTransaction = {
                            "from": userAddress,
                            "to": addr,
                            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                            "gas": 5000000,
                            "chainId": 3,
                            "data": ABIupdateProvider
                        }
                
                        decryptedAccount.signTransaction(rawTransaction)
                        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
                        .then(receipt => {
                            console.log(chalk.cyan("\n\nTransaction receipt: "), receipt)
                            console.log(chalk.cyan("\n\nYou have updated provider settings to: max time = " + maxTime.toString() +
                                ", max target = " + maxTarget.toString() + ", and min price = " + minPrice.toString() + "...\n\n"));
                        })
                        .then(() => {askUser()})
                        .catch(err => {
                            console.log("\n", chalk.red(err), "\n");
                            askUser();
                        });
                    }
                    else{
                        console.log("\n", chalk.red("Error: No file found with file path..."), "\n");
                        askUser();
                    }
                                       
                });
                
            }
            
        })
        .catch( err => {
            console.log("\n", chalk.red(err), "\n");
            askUser();
        });
}




function showPools(){
    //Lists pool all pools
    //checkEvents();
    return myContract.methods.getProviderPool().call().then(function(provPool){
		console.log("\n\n=======================================================");
		console.log("Active provider pool: Total = ", provPool.length);
		console.log(provPool);
		return provPool;
	}).then(function(){
		return myContract.methods.getPendingPool().call().then(function(reqPool){
			console.log("=======================================================")
			console.log("Pending pool:  Total = ", reqPool.length);
			console.log(reqPool);
			return reqPool;
		})
	}).then(function(){
		return myContract.methods.getProvidingPool().call().then(function(providingPool){
			console.log("=======================================================")
			console.log("Providing pool:  Total = ", providingPool.length);
			console.log(providingPool);
			return providingPool;
		})
	}).then(function(){
		return myContract.methods.getValidatingPool().call().then(function(valiPool){
			console.log("=======================================================")
			console.log("Validating pool:  Total = ", valiPool.length);
			console.log(valiPool + "\n\n");
			return valiPool;
            })
            .then(() => askUser())
	}).catch(function(err){
		console.log("Error: show pool error! ", err);
    })
    
}

checkEvents = async () => {
    let pastEvents = await myContract.getPastEvents("allEvents", {fromBlock:  RequestStartTime, toBlock: 'latest'});
    //console.log("Event range: ", RequestStartTime)
    //console.log("All events:", pastEvents)

    for(var i = 0 ; i < pastEvents.length; i++){
      if((pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Validator Signed" && userAddress === pastEvents[i].returnValues.provAddr) || 
        (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Validation Complete" && userAddress === pastEvents[i].returnValues.provAddr) ){
        pastEvents.splice(0,i+1);
        if(pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Validation Complete" && userAddress === pastEvents[i].returnValues.provAddr){
            //validation is complete and now can ask for rating
            canRate = true;
        }
        if(validationAssignedFlag == 0){
            fs.appendFile('./log.txt', "\n" + String(Date(Date.now())) + " Request has been assigned to validator\n", function (err){
                if (err) throw err;
            })
            requestAssignedFlag = 1;
        }
       // console.log("Validator signed/validation complete");
      }
    }

    // For pairing info events
    for (var i = 0; i < pastEvents.length; i++) {
      //console.log(hex2ascii(pastEvents[i].returnValues.info))
      // Request Computation Complete
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Request Computation Completed") {
          //console.log("\nIn complete block\n");
          //console.log("\nuser address is ", userAddress, "\n");
          //console.log(pastEvents[i].returnValues;
        if (userAddress === pastEvents[i].returnValues.reqAddr.toLowerCase()) {
            requestAssignedFlag = 0;
            if(valEntCount == 0){
                validationSelectFlag = true;
                valEntCount+=1;
            }
            fs.appendFile('./log.txt', "\n" + String(Date(Date.now())) + " Request has been completed. Needs validation\n", function (err){
                if (err) throw err;
            })
         // console.log("Awaiting validation", "You have completed a task an are waiting for validation");

         //requestIP = hex2ascii(pastEvents[i].returnValues.extra);
         //receiveResult();
         //prov = 0;
         //askUser();
        }
      }

        // Request Assigned
        if (pastEvents[i].returnValues  && hex2ascii(pastEvents[i].returnValues.info) === "Request Assigned") {
            if(requestAssignedFlag == 0){
                fs.appendFile('./log.txt', "\n" + String(Date(Date.now())) + " Request has been assigned to provider\n", function (err){
                    if (err) throw err;
                })
                requestAssignedFlag = 1;
            }
            
            requestIP = hex2ascii(pastEvents[i].returnValues.extra);
            //console.log("Request has been assigned.");
            finished = false;
            //offer();
        }
        //validation complete
        if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Validation Complete"){
            validationAssignedFlag = 0;
            valEntCount = 0;
            fs.appendFile('./log.txt', "\n" + String(Date(Date.now())) + " Request has been validated\n", function (err){
                if (err) throw err;
            })
            requestIP = hex2ascii(pastEvents[i].returnValues.extra);
            receiveResult();
        }
    }
}


////////////////////////////////////////////////////////////////////////////WEBSITE FUNCTIONS///////////////////////////////////////////////////////////

function listenWebsite(){
    console.log(chalk.cyan("Now listening for webpage...\n"))
    exec('xdg-open ./WebPage/UI.html', (err,stdout,stderr)=>{
        if(err){

          console.log(err);
          return;
        }
        console.log(stdout);
        
    });
    console.log(chalk.cyan('\nWebpage is now open check your default browser...\n'))
    /*exec('sensible-browser https://localhost:3000', (err,stdout,stderr)=>{
        if(err){

          console.log(err);
          return;
        }
        console.log(stdout);
        
    });*/
    var app = express();
    app.listen(3000);
    //json of all available accounts for the user
    app.use(express.json()); //Use to read json of incoming request


    //Allows CORS stuff
    app.use(function (req, res, next) {
        //set headers to allow cross origin requestt
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });


    app.get('/accounts', function(req, res) {
        webpageUp = 1;
        var accountJSON = {"Addresses" : []}
        var counter = 0
        userAddresses.forEach(function(address){
            accountJSON["Addresses"].push({"Address": address});
            counter+=1;
        })
        res.header("Content-Type", 'application/json');
        res.send(accountJSON);
    })


    app.get('/pools', function(req, res) {

        var poolJSON = {"ActiveProviders": 0, "ActiveProviderAddresses" : [], "Pending" : 0, "PendingAddresses" : [], "Providing" : 0, "ProvidingAddresses" : [], "Validating" : 0, "ValidatingAddresses": []};
        return myContract.methods.getProviderPool().call().then(function(provPool){
            poolJSON["ActiveProviders"] = provPool.length;
            for(var i = 0; i<provPool.length; i++){
                poolJSON["ActiveProviderAddresses"].push({"Address": provPool[i]})
            }
            return provPool;
        })
        .then(function(){
            return myContract.methods.getPendingPool().call().then(function(reqPool){
                poolJSON["Pending"] = reqPool.length;
                for(var i = 0; i<reqPool.length; i++){
                    poolJSON["PendingAddresses"].push({"Address": reqPool[i]})
                }
                return reqPool;
            })
        })
        .then(function(){
            return myContract.methods.getProvidingPool().call().then(function(providingPool){
                poolJSON["Providing"] = providingPool.length;
                for(var i = 0; i<providingPool.length; i++){
                    poolJSON["ProvidingAddresses"].push({"Address": providingPool[i]})
                }
                return providingPool;		
            })
        })
        .then(function(){
            return myContract.methods.getValidatingPool().call().then(function(valiPool){
                poolJSON["Validating"] = valiPool.length;
                for(var i = 0; i<valiPool.length; i++){
                    poolJSON["ValidatingAddresses"].push({"Address": valiPool[i]})
                }
                return valiPool;        
            })
        })
        .then(()=>{
            res.header("Content-Type", 'application/json');
            res.send(poolJSON);
        })
        .catch(function(err){
            console.log("Error: show pool error! ", err);
        })
        
    })

    app.post('/startTask', function (req, res) {
        var ABIstartRequest;
        var filename;
        var maxTime = parseInt(req.body["time"])
        var maxTarget = parseInt(req.body["accuracy"])
        var minPrice = parseInt(req.body["cost"])
        filePath = req.body["file"];
        var pass = String(req.body["password"]) // Later set this to req.body["password"]
        //Get file path based on address passed
        for(i = 0; i < UTCFileArray.length; i++){
            if(String(req.body["Account"]) == userAddresses[i].toLowerCase()){
                filename = UTCFileArray[i]
                break
            }
        }
        var keystore;
        UTCfile = filename;
        userAddress = String(req.body["Account"]);
        var contents = fs.readFileSync(filename, 'utf8')
        keystore = contents;
        try{
            decryptedAccount = web3.eth.accounts.decrypt(keystore, pass);
            if(filePath.slice(filePath.length-4, filePath.length) != ".zip")
            {
                console.log("\n", chalk.red("Error: You must provide the task as a .zip file... Select 'start request' to try again..."), "\n")
                app.get('/errors', function(req, res){
                    var errorJSON = {"name" : "startTask", "message" : "You must provide the task as a .zip file... Select 'start request' to try again..."};
                    res.header("Content-Type", 'application/json');
                    res.send(errorJSON);  
                })
            }
            else{
                fs.open(filePath, 'r', (err, fd)=>{
                    //if(err){console.log(chalk.red("\n", chalk.red(err), "\n"));}
                    if(fd != undefined){
                        function readChunk(){
                            chunkSize = 10*1024*1024;
                            var holdBuff = Buffer.alloc(chunkSize);
                            fs.read(fd, holdBuff, 0, chunkSize, null, function(err, nread){
                                //if(err){console.log("\n", chalk.red(err), "\n");}
                                if(nread === 0){
                                    fs.close(fd, function(err){
                                        //if(err){console.log("\n", chalk.red(err), "\n");}
                                    });
                                    return;
                                }
                                if(nread < chunkSize){
                                    try{
                                        buffer.push(holdBuff.slice(0, nread));
                                    }
                                    catch(err){
                                        console.log("You failed to select correct file path")
                                    }
                                }
                                else{
                                    buffer.push(holdBuff);
                                    //console.log(holdBuff)
                                    readChunk();
                        
                                }
                            })
                        } 
                        readChunk();

                        console.log(chalk.cyan("\nmaxtime: " + maxTime + "\nmaxTarget: " + maxTarget + "\nminPrice: " + minPrice));

                        ABIstartRequest = myContract.methods.startRequest(maxTime, maxTarget, minPrice, web3.utils.asciiToHex(ip)).encodeABI();
                        //console.log(ABIstartRequest);
                        const rawTransaction = {
                            "from": String(req.body["Account"]),
                            "to": addr,
                            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                            "gas": 5000000,
                            "chainId": 3,
                            "data": ABIstartRequest
                        }
                    
                        decryptedAccount.signTransaction(rawTransaction)
                        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
                        .then(receipt => {
                            //console.log(chalk.cyan("\n\nTransaction receipt: "));
                            //console.log(receipt);
                            console.log(chalk.cyan("\n\nYour request has been submitted... \n\n"));
                            prov = 1;
                        })
                        .then(() => {//Pedro put your code here for start providing
                            //res.send(JSON.stringify({"Success": 0}));

                            //call subscribe here

                            try{
                                web3.eth.subscribe('newBlockHeaders', (err, result) => {
                                    if(err) console.log(chalk.red(err), result);
                                    //console.log("================================================   <- updated! #", result.number);
                                    //console.log(result);
                                    //showPools();
                                    checkEvents();
                                })
                            }
                            catch(error){
                                alert(
                                    `Failed to load web3, accounts, or contract. Check console for details.`
                                );
                                console.log("\n", chalk.red(err), "\n");
                                app.get('/errors', function(req, res){
                                    var errorJSON = {"name" : "startTask", "message" : "Failed to load web3"};
                                    res.header("Content-Type", 'application/json');
                                    res.send(errorJSON);  
                                })
                            }


                        })
                        .catch(err => {
                            if(String(err).slice(0, 41) == "Error: Returned error: insufficient funds")
                            {
                                console.log(chalk.red("\nError: This keystore account doesn't have enough Ether... Add funds or try a different account...\n"))
                                res.send(JSON.stringify({"Success": 0, "Error":"Not enough ether"}));
                                app.get('/errors', function(req, res){
                                    var errorJSON = {"name" : "startTask", "message" : "This keystore account doesn't have enough Ether... Add funds or try a different account..."};
                                    res.header("Content-Type", 'application/json');
                                    res.send(errorJSON);  
                                })
                            }
                            else{
                                console.log(chalk.red("\nError: ", chalk.red(err), "\n"))
                                app.get('/errors', function(req, res){
                                    var errorJSON = {"name" : "startTask", "message" : "There was an error when attempting to start task"};
                                    res.header("Content-Type", 'application/json');
                                    res.send(errorJSON);  
                                })
                            }
                        });
                    } 
                    else{
                        console.log("\n", chalk.red("Error: No file found with file path..."), "\n")
                        app.get('/errors', function(req, res){
                            var errorJSON = {"name" : "startTask", "message" : "No file found with file path"};
                            res.header("Content-Type", 'application/json');
                            res.send(errorJSON);  
                        })
                    }                 
                });
            }
        }
        catch(err){
            if (String(err).slice(0, 28) == "Error: Key derivation failed")
            {
                console.log(chalk.red("\nError: You have entered the wrong keystore password... Please try again...\n"))
                app.get('/errors', function(req, res){
                    var errorJSON = {"name" : "startTask", "message" : "You have entered an incorrect password"};
                    res.header("Content-Type", 'application/json');
                    res.send(errorJSON);  
                })
            }
        }

    })

    app.post('/updateTask', function(req, res) {
        var ABIstartRequest;
        var filename;
        var maxTime = req.body["time"]
        var maxTarget = req.body["accuracy"];
        var minPrice = req.body["cost"];
        filePath = req.body["file"];
        var pass = String(req.body["password"]) // Later set this to req.body["password"]

        //Get file path based on address passed
        for(i = 0; i < UTCFileArray.length; i++){
            if(String(req.body["Account"]) == userAddresses[i]){
                filename = UTCFileArray[i];
                break
            }
        }

        var keystore;
        var contents = fs.readFileSync(filename, 'utf8')
        keystore = contents;
        UTCfile = filename;
        userAddress = String(req.body["Account"]);
        try{
            decryptedAccount = web3.eth.accounts.decrypt(keystore, pass);


            if(filePath.slice(filePath.length-4, filePath.length) != ".zip")
            {
                console.log("\n", chalk.red("Error: You must provide the task as a .zip file... Select 'start request' to try again..."), "\n")
                app.get('/errors', function(req, res){
                    var errorJSON = {"name" : "updateTask", "message" : "You must provide the task as a .zip file... Select 'start request' to try again..."};
                    res.header("Content-Type", 'application/json');
                    res.send(errorJSON);  
                })
            }
            else{
                fs.open(filePath, 'r', (err, fd)=>{
                    //if(err){console.log(chalk.red("\n", chalk.red(err), "\n"));}
                    if(fd != undefined){
                        function readChunk(){
                            chunkSize = 10*1024*1024;
                            var holdBuff = Buffer.alloc(chunkSize);
                            fs.read(fd, holdBuff, 0, chunkSize, null, function(err, nread){
                                //if(err){console.log("\n", chalk.red(err), "\n");}
                                if(nread === 0){
                                    fs.close(fd, function(err){
                                        //if(err){console.log("\n", chalk.red(err), "\n");}
                                    });
                                    return;
                                }
                                if(nread < chunkSize){
                                    try{
                                        buffer.push(holdBuff.slice(0, nread));
                                    }
                                    catch(err){
                                        console.log("You failed to select correct file path")
                                    }
                                }
                                else{
                                    buffer.push(holdBuff);
                                    //console.log(holdBuff)
                                    readChunk();
                        
                                }
                            })
                        } 
                        readChunk();
                        //console.log(buffer);
                        ABIstartRequest = myContract.methods.updateRequest(maxTime, maxTarget, minPrice, web3.utils.asciiToHex(ip)).encodeABI();
                        //console.log(ABIstartRequest);
                        const rawTransaction = {
                            "from": String(req.body["Account"]),
                            "to": addr,
                            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                            "gas": 5000000,
                            "chainId": 3,
                            "data": ABIstartRequest
                        }
                    
                        decryptedAccount.signTransaction(rawTransaction)
                        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
                        .then(receipt => {
                            //console.log(chalk.cyan("\n\nTransaction receipt: "));
                            //console.log(receipt);
                            console.log(chalk.cyan("\n\nYou have updated request settings to: max time = " + maxTime.toString() +
                            ", max target = " + maxTarget.toString() + ", and min price = " + minPrice.toString() + "...\n\n"));

                            prov = 1;
                        })
                        .then(() => {//Pedro put your code here for start providing
                            //call subscribe here

                            try{
                                web3.eth.subscribe('newBlockHeaders', (err, result) => {
                                    if(err) console.log(chalk.red(err), result);
                                    //console.log("================================================   <- updated! #", result.number);
                                    //console.log(result);
                                    //showPools();
                                    checkEvents();
                                })
                            }
                            catch(error){
                                alert(
                                    `Failed to load web3, accounts, or contract. Check console for details.`
                                );
                                app.get('/errors', function(req, res){
                                    var errorJSON = {"name" : "updateTask", "message" : "failed to load web3"};
                                    res.header("Content-Type", 'application/json');
                                    res.send(errorJSON);  
                                })
                                console.log("\n", chalk.red(err), "\n");
                            }


                        })
                        .catch(err => {
                            if(String(err).slice(0, 41) == "Error: Returned error: insufficient funds")
                            {
                                console.log(chalk.red("\nError: This keystore account doesn't have enough Ether... Add funds or try a different account...\n"))
                                app.get('/errors', function(req, res){
                                    var errorJSON = {"name" : "updateTask", "message" : "This keystore account doesn't have enough Ether... Add funds or try a different account..."};
                                    res.header("Content-Type", 'application/json');
                                    res.send(errorJSON);  
                                })
                            }
                            else{
                                console.log(chalk.red("\nError: ", chalk.red(err), "\n"))
                                app.get('/errors', function(req, res){
                                    var errorJSON = {"name" : "updateTask", "message" : "There was an error updating this task"};
                                    res.header("Content-Type", 'application/json');
                                    res.send(errorJSON);  
                                })
                            }
                        });
                    } 
                    else{
                        console.log("\n", chalk.red("Error: No file found with file path..."), "\n")
                        app.get('/errors', function(req, res){
                            var errorJSON = {"name" : "updateTask", "message" : "No file found with file path"};
                            res.header("Content-Type", 'application/json');
                            res.send(errorJSON);  
                        })
                    }                 
                });
                
            }
        }
        catch(err){
            if (String(err).slice(0, 28) == "Error: Key derivation failed")
            {
                console.log(chalk.red("\nError: You have entered the wrong keystore password... Please try again...\n"))
                app.get('/errors', function(req, res){
                    var errorJSON = {"name" : "updateTask", "message" : "You have entered an incorrect password"};
                    res.header("Content-Type", 'application/json');
                    res.send(errorJSON);  
                })
            }
        }
    })


    app.post('/stopTask', function(req, res){
        var filename;
        for(i = 0; i < UTCFileArray.length; i++){
            if(String(req.body["Account"]) == userAddresses[i].toLowerCase()){
                filename = UTCFileArray[i]
                break
            }
        }
        var keystore;
        var contents = fs.readFileSync(filename, 'utf8')
        keystore = contents;
        var password = String(req.body["password"]);
        UTCfile = filename;
        userAddress = String(req.body["Account"]);
        try{
            const decryptedAccount = web3.eth.accounts.decrypt(keystore, password);
            var ABIstopRequest; //prepare abi for a function call
            ABIstopRequest = myContract.methods.stopRequest().encodeABI();
            const rawTransaction = {
                "from": String(req.body["Account"]),
                "to": addr,
                "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                "gas": 5000000,
                "chainId": 3,
                "data": ABIstopRequest
            }

            decryptedAccount.signTransaction(rawTransaction)
            .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
            .then(receipt => {
                console.log(chalk.cyan("\n\nTransaction receipt: "), receipt)
                console.log(chalk.cyan("\n\nYou have taken down your request for address " + String(req.body["Account"]) + "...\n"))
                prov = 0;
            })
            .catch(err => {
                console.log("\n", chalk.red("Error: "), chalk.red(err), "\n")
                app.get('/errors', function(req, res){
                    var errorJSON = {"name" : "stopTask", "message" : "There was an error when attempting to stop this task"};
                    res.header("Content-Type", 'application/json');
                    res.send(errorJSON);  
                })
            });
        }
        catch(err){
            if (String(err).slice(0, 28) == "Error: Key derivation failed")
            {
                console.log(chalk.red("\nError: You have entered the wrong keystore password... Please try again...\n"))
                app.get('/errors', function(req, res){
                    var errorJSON = {"name" : "stopTask", "message" : "You have entered an incorrect password"};
                    res.header("Content-Type", 'application/json');
                    res.send(errorJSON);  
                })
            }
        }
    })
}