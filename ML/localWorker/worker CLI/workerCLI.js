var inquirer = require('inquirer');
var Web3 = require('web3');
var fs = require('fs');
const prompts = require('prompts');
var figlet = require('figlet');
const chalk = require('chalk');
var path = require('path');
const {exec} = require('child_process');
const Folder = './';
var app = require('express')();
var http = require('http').createServer(app);
var serverIo = require('socket.io')(http, {maxHttpBufferSize:(Math.pow(10,10))});
var clientIo = require('socket.io-client');
var publicIp = require("public-ip");
const hex2ascii = require("hex2ascii");

//position 38 or 37
var validationCounter = 0;
var taskCounter = 0;
var NetworkID = 3;
var serverPort = 3001;
var ClientPort = 3002;
var buffer     = [];
var bufferHol  = [];
var ip         = undefined;
var ip4        = undefined;
var ip6        = undefined;
var mode       = undefined;
var requestAddr= undefined;



///////////////////////////////////////////////////////////////////Get IP///////////////////////////////////////////////////////////////////////////////////
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
      ip = "[" + ip6 + "]:" + serverPort;
    }
    else{
      ip = ip4 + ":3001";
    }
    console.log(ip);
});

///////////////////////////////////////////////////////////////////server///////////////////////////////////////////////////////////////////////////////////
serverIo.on('connection', function(socket){

    socket.on('goodbye', ()=>{
        buffer = undefined;
        requestAddr = undefined;
    });
    //this is sent by another computer to recieve the current file
    //(ex. the provider will send request to the user for the data)
    //there are different calls the two connections to ensure that the
    //data is received
    socket.on('request', () =>{
        chunkSize= 8 * Math.pow(10,6)
        iterations = 
        console.log("Got:request from:" + socket);
        if(buffer !== undefined){
            //socket.emit('transmitting', buffer );
            var chunksize = 5242880; //5MB
            var iterations = Math.ceil(buffer.length / chunksize);
            for(var i = 0 ; i < iterations; i++){
              if(i != iterations - 1) {
                socket.emit('transmitting', buffer.slice(i*chunksize,(i+1)*chunksize-1) , i);
              }
              else{
                socket.emit('transmitting', buffer.slice(i*chunksize,buffer.length), i);
              }
            }
            socket.emit('transmitFin');
            //socket.emit('transmitting', this.state.buffer);
            //console.log("emit:transmitting" );
        }
        else{
        console.log("NO FILE FOUND!! Something seriously wrong has happened. The environment does not have the result saved for some reason.");
        }
    });

    if(buffer === undefined){
        socket.emit('request');
    }
    
    socket.on('transmitting', ( data, iter )=>{
        //console.log("Got data: " + data)
        if(data !== undefined){                     
            //socket.disconnect(true);
            bufferHol.append([data, iter]);
        }
        else{
            socket.emit('request');
        }
      });
    socket.on('transmitFin' , ()=>{
        socket.emit('goodbye'); //tell host that they are done, host can clear buffer
        for(var i = 0 ; i < bufferHol.length; i++){
            var flag = true;
            var counter = 0
            while(flag){
                if(bufferHol[counter][1] == i){
                    buffer.append(bufferHol[counter][0]);
                    flag = false;
                }
                counter += 1;
            }
        }
    });
    
});


//creates the server
http.listen(serverPort , function(){
    console.log('listening on: ' + serverPort);
});


//function to write a file
//this is a helper function for request
function writeFile(data){
    fs.writeFile("image.zip", data, (err) => {
        if(err){
            //writeFile(data) ///might cause an infinite loop, probably should just wait
            console.log('corrupted file')
            return;
        }
        else {
            execute();
        }
    });
}
//execute the python code 
//this is a helper function for request and a call back for writeFile
//this should only be called by write file
function execute(){
    exec('python3 execute.py ' + mode , (err,stdout,stderr)=>{
        if(err){
          console.log(err);
          return;
        }
        console.log(stdout);
        fs.open('image.zip', 'r', (err, fd)=>{
            if(err){console.log(err);return;}
            function readChunk(){
                chunkSize = 10*1024*1024;
                var holdBuff = Buffer.alloc(chunkSize);
                fs.read(fd, holdBuff, 0, chunkSize, null, function(err, nread){
                    if(err){console.log(err);return;}
                    if(nread === 0){
                        fs.close(fd, function(err){
                            if(err){console.log(err);return;}
                        });
                        return;
                    }
                    if(nread < chunkSize){
                        buffer.push(holdBuff.slice(0, nread));
                    }
                    else{
                        buffer.push(holdBuff);
                        //console.log(holdBuff)
                        readChunk();

                    }
                })
            }     
            readChunk();                   
        });
        if(mode === 0 ){
            completeRequest(requestAddr, web3.utils.asciiToHex(ip));
        }
        if(mode === 1 ){
            submitValidation(requestAddr, true);
        }
      });
}
//function to request from another ip address
//(the ip will be either the dataId or requestId)
//it needs to create a client socketIo instance
function request(reqIp){
    //create a client connection
    var clientSocket = clientIo.connect("http://" + reqIp + "/");
    
    //emit the request
    clientSocket.emit('request');

    //this is called when a server send data in responce to this current computer's request
    socket.on('transmitting', ( data, iter )=>{
        //console.log("Got data: " + data)
        if(data !== undefined){                     
            //socket.disconnect(true);
            bufferHol.append([data, iter]);
        }
        else{
            socket.emit('request');
        }
      });
    socket.on('transmitFin' , ()=>{
        socket.emit('goodbye'); //tell host that they are done, host can clear buffer
        for(var i = 0 ; i < bufferHol.length; i++){
            var flag = true;
            var counter = 0
            while(flag){
                if(bufferHol[counter][1] == i){
                    buffer.append(bufferHol[counter][0]);
                    flag = false;
                }
                counter += 1;
            }
        }
    });
}



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
var TaskContract = require('../../../bcai_deploy/client/src/contracts/TaskContract.json');
var abi = TaskContract.abi;
var addr = TaskContract.networks[NetworkID].address;        //align to const ID defination on top
const myContract = new web3.eth.Contract(abi, addr);

//test user account addr : 0x458C5617e4f549578E181F12dA8f840889E3C0A8 and password : localtest
var prov = 0;
var decryptedAccount = "";


questions = {
    type : 'list',
    name : 'whatToDo',
    message: 'What would you like to do?',
    choices : ['start providing', 'show pools', 'quit'],
};

questions1 = {
    type : 'list',
    name : 'whatToDo1',
    message : 'What would you like to do?',
    choices : ['stop providing', 'update provider', 'complete request', 'submit validation', 'show pools', 'quit'],
};


console.log(chalk.blue(" _  ____ _           _       \n(_)/ ___| |__   __ _(_)_ __  \n| | |   | '_ \\ / _` | | '_ \\ \n| | |___| | | | (_| | | | | |\n|_|\\____|_| |_|\\__,_|_|_| |_|\n\n"))

process.on('SIGINT', async () => {
    const response = await prompts({
      type: 'text',
      name: 'val',
      message: 'You must choose the "quit" option before exiting appliation. Type "quit" here if you would like to quit or "back" to go to main menu...\n'
    });
    if(response.val.toLowerCase() == "quit")
    {
        if(prov == 1)
        {
            stopProviding(questions.choices[5]);
        }
        else
        {
            process.exit(-1);
        }
    }
    if(response.val.toLowerCase() == "back"){
        askUser();
    }
});

askUser();

//Gives the user a starting menu of choices
function askUser(){
    if(prov == 0)
        inquirer.prompt([questions]).then(answers => {choiceMade(answers.whatToDo)});
    else
        inquirer.prompt([questions1]).then(answers => {choiceMade(answers.whatToDo1)});
}




//Takes choice made by prompt and controls where to go
function choiceMade(choice){

    if(prov == 0 && choice == questions.choices[0])
    {
        startProviding();
    }
    else if(prov == 1 && choice == questions1.choices[0])
    {
        stopProviding();
    }
    else if(choice == questions1.choices[1])
    {
        updateProvider();
    }
    else if(choice == questions1.choices[2])
    {
        completeRequest();
    }
    else if (choice == questions1.choices[3])
    {
        submitValidation();
    }
    else if (choice == questions.choices[1] || choice == questions1.choices[4])
    {
        showPools();
        checkEvents();
    }
    else
    {
        if(prov == 1)
        {
            stopProviding(choice);
        }
        else{
            process.exit(-1);
        }
    }
}




function startProviding(){

    console.log("\nPut your keystore file in the directory with the CLI ...\n\n");
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
            console.log("\nYou chose account: "+userAddress);
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
                    }
                ])
                .then(settings => {
                    return [settings.mTime, settings.mTarget, settings.mPrice];
                })
                .then(newSettings => {
                    console.log("\nWe are sending transaction to the blockchain... \n");
                    var ABIstartProviding; //prepare abi for a function call
                    var maxTime = newSettings[0];
                    var maxTarget = newSettings[1];
                    var minPrice = newSettings[2];
                    ABIstartProviding = myContract.methods.startProviding(maxTime, maxTarget, minPrice).encodeABI();
                    //console.log(ABIstartProviding);
                    const rawTransaction = {
                        "from": userAddress,
                        "to": addr,
                        "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                        "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                        "gas": 5000000,
                        "chainId": 3,
                        "data": ABIstartProviding
                    }
                
                    decryptedAccount.signTransaction(rawTransaction)
                    .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
                    .then(receipt => {
                        console.log("\n\nTransaction receipt: ", receipt);
                        console.log("\n\nYou are now Providing... \n\n");
                        prov = 1;
                    })
                    .then(() => {//Pedro put your code here for start providing
                        askUser();
                        //call subscribe here

                        try{
                            web3.eth.subscribe('newBlockHeaders', (err, result) => {
                                if(err) console.log("ERRRR", err, result);
                                //console.log("================================================   <- updated! #", result.number);
                                //console.log(result);
                                //showPools();
                                //checkEvents();
                            })
                        }
                        catch(error){
                            alert(
                                `Failed to load web3, accounts, or contract. Check console for details.`
                              );
                              console.log(error);
                        }


                    })
                    .catch(err => {
                        console.error(err);
                        askUser();
                    });
                })
                .catch( err => {
                    console.log(err);
                    askUser();
                });
                    
            })
        }
    else{
        console.log("\nWe are sending transaction to the blockchain... \n");
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
            }
        ])
        .then(settings => {
            return [settings.mTime, settings.mTarget, settings.mPrice];
        })
        .then(newSettings => {
            console.log("\nWe are sending transaction to the blockchain... \n");
            var ABIstartProviding; //prepare abi for a function call
            var maxTime = newSettings[0];
            var maxTarget = newSettings[1];
            var minPrice = newSettings[2];
            ABIstartProviding = myContract.methods.startProviding(maxTime, maxTarget, minPrice).encodeABI();
            //console.log(ABIstartProviding);
            const rawTransaction = {
                "from": userAddress,
                "to": addr,
                "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
                "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
                "gas": 5000000,
                "chainId": 3,
                "data": ABIstartProviding
            }
        
            decryptedAccount.signTransaction(rawTransaction)
            .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
            .then(receipt => {
                console.log("\n\nTransaction receipt: ", receipt);
                console.log("\n\nYou are now Providing... \n\n");
                prov = 1;
            })
            .then(() => {
                askUser()
                
                try{
                    web3.eth.subscribe('newBlockHeaders', (err, result) => {
                        if(err) console.log("ERRRR", err, result);
                        //console.log("================================================   <- updated! #", result.number);
                        //console.log(result);
                        //showPools();
                        //checkEvents();
                    })
                }
                catch(error){
                    alert(
                        `Failed to load web3, accounts, or contract. Check console for details.`
                      );
                      console.log(error);
                }
            
            })
            .catch(err => {
                console.error(err);
                askUser();
            });
        })
        .catch( err => {
            console.log(err);
            askUser();
        });
     
    }
})

}




function stopProviding(choice){
    if(choice == questions.choices[2] || choice == questions1.choices[5])
    {
        console.log("\nProvide keystore password to quit CLI... \n");
    }
    else{
        console.log("\nProvide keystore password to stop providing... \n");
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
            var keystore;
            filename = "UTC--2019-09-16T20-22-39.327891999Z--458c5617e4f549578e181f12da8f840889e3c0a8"
            var contents = fs.readFileSync(filename, 'utf8')
            keystore = contents;
            const decryptedAccount = web3.eth.accounts.decrypt(keystore, password);
            return decryptedAccount;
        }
    )
    .then((decryptedAccount) => {
        console.log("\nWe are sending transaction to the blockchain... \n");
        var ABIstopProviding; //prepare abi for a function call
        ABIstopProviding = myContract.methods.stopProviding().encodeABI();
        const rawTransaction = {
            "from": userAddress,
            "to": addr,
            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
            "gas": 5000000,
            "chainId": 3,
            "data": ABIstopProviding
        }

        decryptedAccount.signTransaction(rawTransaction)
        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
        .then(receipt => {
            console.log("\n\nTransaction receipt: ", receipt)
            console.log("\n\nYou have now stopped providing...\n")
            prov = 0;
        })
        .then(() => {

            if(choice == questions.choices[2] || choice == questions1.choices[5])
            {
                console.log("Now quitting CLI ...\n\n");
                decryptedAccount.signTransaction(rawTransaction)
                process.exit(-1);
            }
            else
            {
                askUser();
            }
        })
        .catch(err => console.error(err));
    })
    .catch( err => {
        console.log(err)
        askUser()
    });
}




function updateProvider(){
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
            }
        ])
        .then(settings => {
            return [settings.mTime, settings.mTarget, settings.mPrice];
        })
        .then(newSettings => {
            console.log("\nWe are sending transaction to the blockchain... \n");
            var ABIupdateProvider; //prepare abi for a function call
            var maxTime = newSettings[0];
            var maxTarget = newSettings[1];
            var minPrice = newSettings[2];
            ABIupdateProvider = myContract.methods.updateProvider(maxTime, maxTarget, minPrice).encodeABI();
            //console.log(ABIstartProviding);
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
                console.log("\n\nTransaction receipt: ", receipt)
                console.log("\n\nYou have updated provider settings to: max time = " + maxTime.toString() +
                    ", max target = " + maxTarget.toString() + ", and min price = " + minPrice.toString() + "...\n\n");
            })
            .then(() => {askUser()})
            .catch(err => {
                console.error(err)
                askUser();
            });
        })
        .catch( err => {
            console.log(err)
            askUser()
        });
}

function completeRequest(reqAddress, resultId){
    taskCounter+=1;
    console.log("Completed task. You now have completed "+taskCounter+" tasks and "+validationCounter+" validations... \n");
    console.log("\nWe are sending transaction to the blockchain... \n");
        var ABIcompleteRequest; //prepare abi for a function call
        ABIcompleteRequest = myContract.methods.completeRequest(reqAddress, resultId).encodeABI();
        const rawTransaction = {
            "from": userAddress,
            "to": addr,
            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
            "gas": 5000000,
            "chainId": 3,
            "data": ABIcompleteRequest
        }

        decryptedAccount.signTransaction(rawTransaction)
        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
        .then(receipt => {
            console.log("\n\nTransaction receipt: ", receipt)
        })
        .then(() => {
            askUser();
        })
        .catch(err => console.error(err));
}

function submitValidation(reqAddress, result){
    validationCounter+=1;
    console.log("Completed task. You now have completed "+taskCounter+" tasks and "+validationCounter+" validations... \n");
    console.log("\nWe are sending transaction to the blockchain... \n");
        var ABIsubmitValidation; //prepare abi for a function call
        ABIsubmitValidation = myContract.methods.submitValidation(reqAddress, result).encodeABI();
        const rawTransaction = {
            "from": userAddress,
            "to": addr,
            "value": 0, //web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
            "gasPrice": web3.utils.toHex(web3.utils.toWei("30", "GWei")),
            "gas": 5000000,
            "chainId": 3,
            "data": ABIsubmitValidation
        }

        decryptedAccount.signTransaction(rawTransaction)
        .then(signedTx => web3.eth.sendSignedTransaction(signedTx.rawTransaction))
        .then(receipt => {
            console.log("\n\nTransaction receipt: ", receipt)
        })
        .then(() => {
            askUser();
        })
        .catch(err => console.error(err));
    
}




function showPools(){
    //Lists pool all pools
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

       // console.log("Validator signed/validation complete");
      }
    }

    // For pairing info events
    for (var i = 0; i < pastEvents.length; i++) {

        // Request Assigned
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Request Assigned") {
          console.log()
        if (pastEvents[i] && userAddress.toLowerCase() === pastEvents[i].returnValues.provAddr.toLowerCase()) {
            console.log("You Have Been Assigned A Task", "You have been chosen to complete a request for: " + pastEvents[i].returnValues.reqAddr + " The server id is:" + hex2ascii(pastEvents[i].returnValues.extra));
            mode = 0;
            request(hex2ascii(pastEvents[i].returnValues.extra));
            requestAddr = pastEvents[i].returnValues.reqAddr;
        }
      }

      // Request Computation Complete
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Request Computation Completed") {
        if (pastEvents[i] && userAddress === pastEvents[i].returnValues.provAddr) {
         // console.log("Awaiting validation", "You have completed a task an are waiting for validation");
        }
      }

      // Validation Assigned to Provider
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Validation Assigned to Provider") {
          console.log
        if (pastEvents[i] && userAddress === pastEvents[i].returnValues.provAddr) {
            // console.log("You are a validator", "You need to validate the task for: " + pastEvents[i].reqAddr + " as true or false. The server id is:" + hex2ascii(pastEvents[i].returnValues.extra));
            mode = 1;
            request(hex2ascii(pastEvents[i].returnValues.extra));
        }
      }

      // Not Enough validators
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Not Enough Validators") {
        if (userAddress === pastEvents[i].returnValues.provAddr) {
          //console.log("Not Enough Validators", "There were not enough validators to verfiy your resulting work. Please wait." + pastEvents[i].returnValues.reqAddr);
        }
      }

      // Enough Validators
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Enough Validators") {
        if (userAddress === pastEvents[i].returnValues.provAddr) {
         // console.log("All Validators Found", "Your work is being validated. Please hold.");
        }
      }


      // Validator Signed
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Validator Signed") {
        if (userAddress === pastEvents[i].returnValues.provAddr) {
          //console.log("You Have signed your validation", "You have validated the request for: " + pastEvents[i].returnValues.reqAddr);
            mode        = undefined;
            buffer      = undefined;
            requestAddr = undefined;
        }
      }


      // Validation Complete
      if (pastEvents[i].returnValues && hex2ascii(pastEvents[i].returnValues.info) === "Validation Complete") {
        if (userAddress === pastEvents[i].returnValues.provAddr) {
          console.log("Work Validated!", "Your work was validated and you should receive payment soon");
          mode = undefined;
        }
        //console.log(pastEvents[i].blockNumber);
      }
    }
}


