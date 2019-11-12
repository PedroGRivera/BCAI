var Web3 = require('web3');
var TaskContract = require('../../../bcai_deploy/client/src/contracts/TaskContract.json');
var abi = TaskContract.abi;
var addr = TaskContract.networks[NetworkID].address;        //align to const ID defination on top
const myContract = new Web3.eth.Contract(abi, addr);
var account = "0xcc90abef8180d0ab5974dd0f1247623bc246eef8";

var count = 0;
console.log("Begining gas estimate data collection...");
while(count < 100){
    
    var gas = myContract.methods.getProviderPool.estimateGas({from: account});
    console.log("Estimated gas cost to be: " + gas + "\n"); 

    count++;
}
console.log("Data collection complete");