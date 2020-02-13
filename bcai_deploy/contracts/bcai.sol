/////////////////////////////////////////////////////////////////////////////////////
//version 3.0.0
//Author: Taurus, Samuel Pritchett
//Copyright: tlu4@lsu.edu
//
//update from 2.1 -> 3.0, keep alignment with the project version v3.0, which is a stable release version.
//NOTE: at the time Aug, 2019 the amount of contract code is close to its limit,
//      adding more functions may result in a failure in deployment.
//update Apr. 2019: fixed validateReqeust Logic: validator list is updated when selection,
//      signature list is updated when result submitted, to avoid multi-submission
//      did not change function parameter, should not break anything.
///////////////////////////////////////////////////////////////////////////////////////
//NOTE:
//This design uses account address as the identifier, meaning each address could only have one req/prov associated.
//When submit new or update existing req/prov, previous record are overwriten.
//Each address could only have one req or prov, not at same time.

//TODO: add conflict detection of the address. Check whether existing req or prov from your address is 'not complete',(being proccessed).
//TODO: Aug.2019, add a hard-reset function. Totally remove one request or stop provider from the pool
//      , no matter their status (being processed or pending), because sometimes, one will stuck in the pool.
////////////////////////////////////////////////////////////////////////////////////

pragma solidity >=0.5.1;
pragma experimental ABIEncoderV2;           //enable returning self-defined type, used in helper return provider and request
                                            //do not disable, provider is returned for debuging reason.
contract bcaiReputation {

    mapping (address => reputation) public ratings; //user address -> reputation struct

    struct reputation{
        uint128 numRatings;
        uint128 avgRating;
        uint128[5] lastFive;
        bool newUser;
    }

    //Final version this needs to be internal
    function addRating (address user, uint128 rating) public {
        if(ratings[user].numRatings != 0){
            ratings[user].avgRating = (rating + (ratings[user].numRatings * ratings[user].avgRating)) / (ratings[user].numRatings + 1);
            ratings[user].numRatings++;
            for(uint8 i = 4; i != 0; i--){//shift the array so we can add newest rating
                ratings[user].lastFive[i] = ratings[user].lastFive[i - 1];
            }
            ratings[user].lastFive[0] = rating;

            if(ratings[user].numRatings == 5){
                ratings[user].newUser = false;
            }
        }
        else {//this is their first rating, simpler logic
            ratings[user].avgRating = rating;
            ratings[user].lastFive[0] = rating;
            ratings[user].numRatings++;
        }
    }

    function getNumRatings (address user) public view returns(uint128){
        return ratings[user].numRatings;
    }

    function getAvgRating (address user) public view returns(uint128){
        return ratings[user].avgRating;
    }

    function getLastFive (address user) public view returns(uint128[5] memory) {
        return ratings[user].lastFive;
    }

}

contract TaskContract is bcaiReputation{

    mapping (address => Provider) public providerList;   //provAddr => provider struct
    mapping (address => Request)  public requestList;    //reqAddr => request struct

    struct Request {
        uint256 blockNumber;                //record the time of submission
        address payable provider;           //record the provider assigned to this request
        uint64  time;                       //maximum time requirements                 TODO: determine the unit and format
        uint16  target;                     //target 0-100.00                           TODO: determine the unit and format
        uint256 price;                      //the max amount he willing to pay          TODO: determine the unit and format
        bytes   dataID;                     //dataID used to fetch the off-chain data, interact with ipfs
        bytes   resultID;                   //dataID to fetch the off-chain result, via ipfs
        uint64  numValidations;             //user defined the number of validation, TODO: fix this as 3
        address payable[] validators;       //validators' addr, update when assigned the task to validators
        bool[]  signatures;                 //true or false array, update only when validator submit result
        bool    isValid;                    //the final flag
        byte    status;                     //one byte indicating the status: 0: 'pending', 1:'providing', 2: 'validating', 3: 'complete'
    }

    struct Provider {
        uint256 blockNumber;                //record the time of submission
        uint64  maxTime;                    //maxTime of Prov's should be larger than Req's to successfully assign
        uint16  maxTarget;                  //max target he can provide
        uint256 minPrice;                   //lowest price he can accept
        bool    available;                  //if ready to be assigned
    }

    //should try best to reduce type of events in order to remove unnecessary confusion. -> reuse events with same format
    //no need seperate events for each type, just put whatever info passed in bytes info
    event IPFSInfo          (address payable reqAddr, bytes info, bytes extra);
    event SystemInfo        (address payable reqAddr, bytes info);          //systemInfo is only informative, not trigger anything.
    event PairingInfo       (address payable reqAddr, address payable provAddr, bytes info);
    //NOTE: [by TaoLu] extra here are actually dataID, which can also be accessed via reqAddr.
    //      extra may not be necessary but it makes easier of app to handle info. This retains the tradeoff of gas cost and easyness.
    event PairingInfoLong   (address payable reqAddr, address payable provAddr, bytes info, bytes extra);


    //Pools stores the address of req or prov, thus indicate the stages.
    address payable[] providerPool;        //provAddr only when more providers > req, or empty
    address payable[] pendingPool;         //reqAddr only when more requests > prov, or empty
    address payable[] providingPool;       //reqAddr
    address payable[] validatingPool;      //reqAddr
    /////////////////////////////////////////////////////////////////////////////////////

    // Function called to become a provider. Add address on List, and Pool if not instantly assigned.
    // TIPS on gas cost: don't create local copy and write back, modify the storage directly.
    //      gas cost 165K without event / 167K with event / 92K overwrite
    function startProviding(uint64 maxTime, uint16 maxTarget, uint64 minPrice) public returns (bool) {
        if(providerList[msg.sender].blockNumber == 0){                  //if this is new
            providerList[msg.sender].blockNumber = block.number;
            providerList[msg.sender].maxTime = maxTime;
            providerList[msg.sender].maxTarget = maxTarget;
            providerList[msg.sender].minPrice = minPrice;
            providerList[msg.sender].available = true;

            providerPool.push(msg.sender);
            emit SystemInfo (msg.sender, "Provider Added");
            return true;
        }
        else {                                                          //this address has been recorded before
            return updateProvider(maxTime, maxTarget, minPrice);        //this could be an update
        }
    }
    // Stop a provider. Must be sent from the provider address or it will be failed.
    function stopProviding() public returns (bool) {
        // If the sender is currently an active provider
        if (providerList[msg.sender].available == true){               //can only stop available provider
            delete providerList[msg.sender];                           //delete from List
            emit SystemInfo(msg.sender, 'Provider Stopped');
            return ArrayPop(providerPool, msg.sender);                 //delete from Pool
        }
        else{
            emit SystemInfo(msg.sender, 'Provider Unable to Stop');
            return false;
        }
    }
    //update a provider, you must know the provAddr and must sent from right addr
    function updateProvider(uint64 maxTime, uint16 maxTarget, uint64 minPrice) public returns (bool) {
        if(providerList[msg.sender].available == true){                //can only modify available provider
            providerList[msg.sender].blockNumber = block.number;
            providerList[msg.sender].maxTime = maxTime;
            providerList[msg.sender].maxTarget = maxTarget;
            providerList[msg.sender].minPrice = minPrice;
            emit SystemInfo(msg.sender,'Provider Updated');
            return true;
        }
        else{
            emit SystemInfo(msg.sender, 'Provider Unable to Update');
            return false;
        }
    }

    // Send a request from user to blockchain. Assumes price is including the cost for verification
    // NOTE: use bytes memory as argument will increase the gas cost, one alternative will be uint type, may consifer in future.
    function startRequest(uint64 time, uint16 target, uint64 price, bytes memory dataID) public payable returns (bool) {
        if(requestList[msg.sender].blockNumber == 0){   //never submitted before
            //register on List
            requestList[msg.sender].blockNumber = block.number;
            requestList[msg.sender].provider = address(0);
            //requestList[msg.sender].validator = address(0);
            requestList[msg.sender].time = time;
            requestList[msg.sender].target = target;
            requestList[msg.sender].price = price;
            requestList[msg.sender].dataID = dataID;
            requestList[msg.sender].numValidations = 1;//fixed 3 for testing reasons >> TL: changed this to demo settings
            requestList[msg.sender].status = '0';       //pending = 0x30, is in ascii not number 0
            pendingPool.push(msg.sender);
            emit IPFSInfo (msg.sender, "Request Added", dataID);
            return true;
        } else {    //submitted before
            return updateRequest(time, target, price, dataID);
        }
    }
    function stopRequest() public returns (bool){
        if (requestList[msg.sender].status == '0'){          //can only cancel owned pending request, ('0' = 0x30)
            delete requestList[msg.sender];                  //delete from List
            emit SystemInfo(msg.sender, 'Request Stopped');
            return ArrayPop(pendingPool, msg.sender);        //delete from Pool
        }
        else{
            emit SystemInfo(msg.sender, 'Request Unable to Stop');
            return false;
        }
    }
    function updateRequest(uint64 time, uint16 target, uint64 price, bytes memory dataID) public payable returns (bool) {
        if(requestList[msg.sender].status == '0' ){                   //can only update pending request
            requestList[msg.sender].blockNumber = block.number;
            requestList[msg.sender].time = time;
            requestList[msg.sender].target = target;
            requestList[msg.sender].price = price;
            requestList[msg.sender].dataID = dataID;
            emit SystemInfo(msg.sender, 'Request Updated');
            return true;
        }
        else{
            emit SystemInfo(msg.sender, 'Request Unable to Update');
            return false;
        }
    }


    //Add provAddr to request as a provider if they are available and their prices match up
    //     Called by user who wants to choose provAddr to work for them
    //     Returns '0' on success, '1' on failure
    function chooseProvider(address payable provAddr) public returns (byte){
        if(requestList[msg.sender].status == '0'){ //Since this is ascii '0' its actually 0x30, users who have not submitted a task shouldn't get through here
            if(providerList[provAddr].available == true && providerList[provAddr].minPrice <= requestList[msg.sender].price){ //if chosen provider is in the providerPool and their prices match
                
                providerList[provAddr].available = false;
                ArrayPop(providerPool, provAddr);

                requestList[msg.sender].provider = provAddr;
                requestList[msg.sender].status = '1';
                ArrayPop(pendingPool, msg.sender);
                providingPool.push(msg.sender);                

                emit PairingInfoLong(msg.sender, provAddr, "Request Assigned", requestList[msg.sender].dataID);
                return '0';
            }
            else{
                emit SystemInfo(msg.sender, 'Chosen provider is not available to work');
                return '1';
            }
        }
        // else if(requestList[msg.sender].status == '2' && requestList[msg.sender].validator == address(0)){
        //     providerList[provAddr].available = false;
        //     ArrayPop(providerPool, provAddr);

        //     requestList[msg.sender].validator = provAddr;
        //     emit PairingInfoLong(msg.sender, provAddr, 'Validation Assigned to Provider', requestList[msg.sender].resultID);
            
        // }
        else{
            if(requestList[msg.sender].status == '1'){
                emit SystemInfo(msg.sender, 'Your request already has a provider assigned');
            }
            else{
                emit SystemInfo(msg.sender, 'You do not have a request');
            }
            return '1';
        }
    }

    // Search in the requestPool, find a job for current provider. Triggered by startProviding
    // Returns: note: return value all in ascii format
    //          0: successfully assigned
    //          1: searched all providers but find no match
    //          2: no available provider right now
    //          3: failure during poping pool
    // function assignProvider(address payable provAddr) private returns (byte){
    //     if(pendingPool.length == 0) return '2';     //no pending requests
    //     else {   //search throught the requestPool
    //         for (uint64 i = 0; i < pendingPool.length; i++){
    //             address payable reqAddr = pendingPool[i];
    //             if( (reqAddr != address(0) && requestList[reqAddr].status != '1') &&
    //                 requestList[reqAddr].time <= providerList[provAddr].maxTime &&
    //                 requestList[reqAddr].target <= providerList[provAddr].maxTarget &&
    //                 requestList[reqAddr].price >= providerList[provAddr].minPrice){
    //                     //meet the requirement, assign the task
    //                     //update provider
    //                     providerList[provAddr].available = false;
    //                     ArrayPop(providerPool, provAddr);
    //                     //update request
    //                     requestList[reqAddr].provider = provAddr;
    //                     requestList[reqAddr].status = '1';    //providing
    //                     ArrayPop(pendingPool, reqAddr);
    //                     providingPool.push(reqAddr);
    //                     //status move from pending to providing
    //                     emit PairingInfoLong(reqAddr, provAddr, "Request Assigned", requestList[reqAddr].dataID);
    //                     return '0';
    //             }
    //         }
    //         //after for loop and no match
    //         return '1';
    //     }
    // }

    // Assigning one task to one of the available providers. Only called from requestTask (private)
    // Search in the providerPool, if no match in the end, return false
    //could only assign one task at a time
    //auto sel the first searching result for now, no comparation between multiple availability.
    //TODO: need ot add preference next patch
    // Returns: 0: successfully assigned
    //          1: searched all providers but find no match
    //          2: no available provider right now
    //          3: failure during poping pool
    // function assignRequest(address payable reqAddr) private returns (byte) {
    //     //provider availability is checked in pool not in list
    //     if (providerPool.length == 0)   return '2';
    //     else {            //if any provider in pool
    //         for (uint64 i = 0; i < providerPool.length; i++) {
    //             address payable provAddr = providerPool[i];   // save the provider's addr, reusable and save gas cost
    //             if (provAddr != address(0) && providerList[provAddr].available == true){
    //                 // Check if request conditions meet the providers requirements
    //                 if (requestList[reqAddr].target <= providerList[provAddr].maxTarget &&
    //                     requestList[reqAddr].time <= providerList[provAddr].maxTime &&
    //                     requestList[reqAddr].price >= providerList[provAddr].minPrice) {
    //                     //update provider:
    //                     providerList[provAddr].available = false;
    //                     ArrayPop(providerPool, provAddr);
    //                     //update request
    //                     requestList[reqAddr].provider = provAddr;
    //                     requestList[reqAddr].status = '1';    //providing
    //                     ArrayPop(pendingPool, reqAddr);
    //                     providingPool.push(reqAddr);
    //                     // Let provider listen for this event to see he was selected
    //                     emit PairingInfoLong(reqAddr, provAddr, "Request Assigned", requestList[reqAddr].dataID);
    //                     return '0';
    //                 }
    //             }
    //         }
    //         return '1';
    //     }
    // }

    // Provider will call this when they are done and the result data is available.
    // This will invoke the validation stage. Only when the request got enough validators,
    // that req could be moved from pool and marked. Or that req stays providing
    function completeRequest(address payable reqAddr, bytes memory resultID) public returns (bool) {
        // Confirm msg.sender is actually the provider of the task he claims
        if (msg.sender == requestList[reqAddr].provider) {
            //change request obj
            requestList[reqAddr].status = '2';    //validating
            requestList[reqAddr].resultID = resultID;
            //move from providing pool to validating Pool.
            ArrayPop(providingPool, reqAddr);
            validatingPool.push(reqAddr);
            //release provider (not necessarily depend on provider) back into providerPool
            providerList[msg.sender].available = true;
            providerPool.push(msg.sender);
            emit IPFSInfo(reqAddr, 'Request Computation Completed',requestList[reqAddr].resultID);
            //start validation process
            return true;
        }
        else {
            return false;
        }
    }

    // Called by completeRequest before finalizing stuff. NOTE: must have no validators right now
    // Try to find as many as possible qualified validators
    // Returns false if there wasnt enough free providers to send out the required number of validation requests
    // need validation from 1/10 of nodes -- could change
    // function validateRequest(address payable reqAddr) private returns (bool) {
    //     uint64 validatorsFound = 0;
    //     //select # of available provider from the pool and force em to do the validation
    //     for (uint64 i = 1; i <= providerPool.length; i++) {
    //         address payable provAddr = providerPool[i - 1]; //get provider ID
    //         //TODO: check whether selected validator capable with parameters (time, accuracy,....)
    //         if(provAddr != requestList[reqAddr].provider){   //validator and computer cannot be same
    //             emit PairingInfoLong(reqAddr, provAddr, 'Validation Assigned to Provider', requestList[reqAddr].resultID);
    //             validatorsFound++;
    //             //remove the providers availablity and pop from pool
    //             requestList[reqAddr].validators.push(provAddr);
    //             requestList[reqAddr].signatures.push(false);    //push false to hold position
    //             providerList[provAddr].available = false;
    //             ArrayPop(providerPool, provAddr);
    //             i--;

    //         } else continue;    //skip the provider/computer itself
    //         //check whether got enough validator
    //         if(validatorsFound < requestList[reqAddr].numValidations){
    //             continue;
    //         }
    //         else{       //enough validator
    //             emit SystemInfo(reqAddr, 'Enough Validators');
    //             return true;
    //         }
    //         //loop until certain # of validators selected
    //     }
    //     //exit loop without enough validators
    //     emit SystemInfo(reqAddr, 'Not Enough Validators');
    //     return false;
    // }

    // needs to be more secure by ensuring the submission is coming from someone legit
    // similar to completeTask but this will sign the validation list of the target Task
    // TODO: the money part is ommited for now
    function submitValidation(address payable reqAddr, bool result) public returns (bool) {
        if(msg.sender != requestList[reqAddr].provider) {     //validator cannot be provider
            for (uint64 i = 0; i<requestList[reqAddr].validators.length; i++){
                if(requestList[reqAddr].validators[i] == msg.sender &&  // vali must be previous validator assigned
                requestList[reqAddr].signatures[i] == false){        // not yet signed
                    requestList[reqAddr].signatures[i] = result;        //length is matched, this prevent multi-submission and can update his own
                    providerList[msg.sender].available = true;          //release validator
                    providerPool.push(msg.sender);
                    emit PairingInfo(reqAddr, msg.sender, 'Validator Signed');
                }
                else continue;   //either submitted already or not find , go for next
            }
            checkValidation(reqAddr);
        }
        else   //submit vali from provider
            return false;

    }

    //TODO: what if result is invalid
    function checkValidation(address payable reqAddr) private returns (bool) {
        bool flag = false;
        uint64 successCount = 0;
        for (uint64 i = 0; i<requestList[reqAddr].signatures.length; i++) {
           if (requestList[reqAddr].signatures[i] == true) successCount += 1;
        }
        if (successCount >= requestList[reqAddr].numValidations) {
            requestList[reqAddr].isValid = true; // Task was successfully completed!
            emit IPFSInfo(reqAddr, 'Validation Complete', requestList[reqAddr].resultID);
        }
        return flag;
    }


    // called by startProviding if the validatingPool is not empty
    // assigns the new provider to validate a task
    // IDEA: Could be modified so that any available provider could call. For now it assumes only used on new providers in startProviding
    // function findValidation(address payable provAddr) private {
    //     for(uint64 i = 0; i < validatingPool.length; i++){  //search the entire validatingpool
    //         address payable reqAddr = validatingPool[i]; //set reqAddr current task
    //         if(requestList[reqAddr].numValidations > requestList[reqAddr].validators.length){ //check to see if the task has enough validators
    //             //since the provAddr is a new provider, we don't need to check if he is already a validator, should be impossible unless bug exists
    //             if(provAddr != requestList[reqAddr].provider){ //check to make sure he is not the privider
    //                 emit PairingInfoLong(reqAddr, provAddr, 'Validation Assigned to Provider',requestList[reqAddr].resultID);
    //                 requestList[reqAddr].validators.push(provAddr);
    //                 requestList[reqAddr].signatures.push(false);    //extend length to match length of validator list
    //                 providerList[provAddr].available = false;
    //                 ArrayPop(providerPool, provAddr);

    //                 //alert task owner if their task now has enough validators
    //                 if(requestList[validatingPool[i]].validators.length == requestList[validatingPool[i]].numValidations){
    //                     emit SystemInfo(reqAddr, 'Enough Validators');
    //                 }
    //                 break;
    //             }
    //             //else he is provider, did nothing
    //         }
    //         else continue; //this req has already got enough, check next
    //     }
    // }

    // finalize the completed result, move everything out of current pools
    function finalizeRequest(address payable reqAddr, bool toRate, uint8 rating) public returns (bool) {
        if(requestList[reqAddr].isValid){
            ArrayPop(validatingPool, reqAddr);
            if(toRate){ //If user wishes to, let them rate the provider
                addRating(requestList[reqAddr].provider, rating);
            }
            delete requestList[reqAddr]; //delete user from mapping
        }
    }


/////////////////////////////////////////////////////////////////////
    // Used to dynamically remove elements from array of open provider spaces.
    // Using a swap and delete method, search for the desired addr throughout the whole array
    // delete the desired and swap the hole with last element
    function ArrayPop(address payable[] storage array, address payable target) private returns (bool) {
        for(uint64 i = 0; i < array.length; i++){
            if (array[i] == target) {
                array[i] = array[array.length-1];   //swap last element with hole
                delete array[array.length-1];       //delete last item
                //array.length -= 1;                  //decrease size
                return true;
            }
        }
        return false;   //fail to search: no matching in pool
    }
    

    /////////////////////////////////////////////////////////////////////////////////
    //some helpers defined here
    //NOTE: these helpers will use up the code space, (in Ethereum code lenght is limited)
    //      can be removed in future to free up space.

    // function getProvider(address payable ID) public view returns(Provider memory){
    //     return providerList[ID];
    // }
    // function getRequest(address payable ID) public view returns (Request memory){
	//     return requestList[ID];
    // }

    function getProviderPool() public view returns (address payable[] memory){
        return providerPool;
    }
    function getPendingPool() public view returns (address payable[] memory){
        return pendingPool;
    }
    function getValidatingPool() public view returns (address payable[] memory){
        return validatingPool;
    }
    function getProvidingPool() public view returns (address payable[] memory){
        return providingPool;
    }

    // function getProviderPoolSize() public view returns (uint256){
    //     return providerPool.length;
    // }
    // function getRequestPoolSize() public view returns (uint256){
    //     return pendingPool.length;
    // }
}
