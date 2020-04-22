import os
import sys
import requests as r
import time
import json
from signal import signal, SIGINT
import threading
from datetime import datetime
import math
import multiprocessing
import subprocess

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

##globals##
threads    = 8
threadL    = []
orderAddr  = []
order      = []
startTimes = []
mainThread = None
totalAddr  = ''
totalStartTime = 0
content = []
for i in range(threads):
    content.append(b'')#inits list with threads number of empty byte arrays
mode       = '' #user, provider, or validator
lockModeAt = "user" #varialbe that locks the mode as whatever the variable is set at
mode       = lockModeAt
fileName   = ''
encKey     = None
encNonce   = None
#######################################################################################################################################
#######################################################encryption######################################################################
#######################################################################################################################################

def genKey():
    keyFile= "key.txt"
    nonceFile="nonce.txt"
    f = open(keyFile, 'w')
    f.close()
    f = open(nonceFile, 'w')
    f.close()
    key = os.urandom(32)
    nonce = os.urandom(32)
    f = open(keyFile, 'wb')
    f.write(key)
    f.close()
    f = open(nonceFile, 'wb')
    f.write(nonce)
    f.close()    
def getKey(keyFile="", nonceFile=""):
    f = open(keyFile, 'rb')
    key = f.read()
    f.close()
    f = open(nonceFile, 'rb')
    nonce = f.read()
    f.close()
    return [key, nonce]

def enc(key=b"", nonce=b"", mess=b""):
    alg = algorithms.AES(key)
    cipher = Cipher(alg, modes.GCM(nonce), default_backend())
    encryptor = cipher.encryptor()
    return encryptor.update(mess)

def dec(key=b"", nonce=b"", mess=b""):
    alg = algorithms.AES(key)
    cipher = Cipher(alg, modes.GCM(nonce), default_backend())
    decryptor = cipher.decryptor()
    return decryptor.update(mess)



#######################################################################################################################################
###########################################################host########################################################################
#######################################################################################################################################
def shareOrder():
    global totalStartTime
    while os.path.isfile('totalOrder.txt') != True:
        time.sleep(5)
    totalStartTime = time.time()
    
    ######zip the total order, key, and nonce to share#########
    os.system('zip totalOrder.zip totalOrder.txt key.txt nonce.txt >/dev/null 2>&1')
    time.sleep(5)    

    ###########################################################

    subprocess.Popen(["script -c \"../../../onionshare/dev_scripts/onionshare --website totalOrder.zip" + "\" -f onionshareOrder.txt"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,shell=True)
def startShare(file, iter):
    #print(file + ":" + str(iter))
    #start onionshare server to host file
    subprocess.Popen(["script -c \"../../../onionshare/dev_scripts/onionshare --website " + file + "\" -f onionshare" + str(iter) + ".txt"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,shell=True)

def splitFile(file):
    fileName = file
    f       = open(file,'rb')
    lines   = f.readlines()
    lineLen = len(lines)
    pos     = 0

    #print(lines)
    for i in range(0, threads):
        fw = open(file+str(i)+'.txt' ,'wb')
        lo = int((i)*(lineLen/threads))
        hi = int((i+1)*(lineLen/threads))
        fw.writelines(lines[lo:hi])
        fw.close()
        order.append(file+str(i)+'.txt\n')
        keyFile = open("key.txt", 'rb')
        key = keyFile.read()
        keyFile.close()
        nonceFile = open("nonce.txt", "rb")
        nonce = nonceFile.read()
        nonceFile.close()
        fenc = open(file+str(i)+'.txt', "rb")
        hold = enc(key, nonce, fenc.read())
        fenc.close()
        fenc = open(file + str(i) + ".txt", "w")
        fenc.close
        fenc = open(file+str(i)+".txt", "wb")
        fenc.write(hold)
        fenc.close()
    f.close()
    f = open('order.txt', 'w')
    f.writelines(order)
    f.close()

def createThreadsHost():
    f = open("order.txt" , 'r')
    orderFile = f.readlines()
    f.close()
    j = 0
    for i in orderFile:
        #t=threading.Thread(target=startShare,args=[i.strip('\n'),j]) 
        t=multiprocessing.Process(target=startShare,args=(i.strip('\n'),j,)) 
        threadL.append(t)
        j += 1

def runThreads():
    for i in threadL:
        i.start()
        startTimes.append(time.time())
        #print(startTimes)

def getAddrs():
    #for i in range(0,threads):
        #orderAddr.append(0)
    t = 0
    while t < threads:
        global orderAddr
        t = 0
        for i in orderAddr:
            if i != 0:
                t +=1
        for i in range(0,threads):
            if os.path.isfile('onionshare'+str(i)+'.txt'):
                f = open('onionshare'+str(i)+'.txt', 'r')
                lines = f.readlines()
                f.close()
                for j in lines:
                    if (j.find("http://onionshare") >= 0): #found address
                        orderAddr[i] = j.strip('\n') + "/" + order[i].strip('\n')
        #print(orderAddr)
        time.sleep(5)
    #print(orderAddr)
    f = open('totalOrder.txt', 'w')
    for i in orderAddr:
        f.write(i + '\n')
    f.close()

def getTotalAddr():
    global totalAddr
    flag = True
    while(flag):
        if os.path.isfile('onionshareOrder.txt'):
            f = open('onionshareOrder.txt', 'r')
            lines = f.readlines()
            f.close()
            for j in lines:
                if (j.find("http://onionshare") >= 0): #found address
                    totalAddr = j.strip('\n') + "/totalOrder.zip"
                    flag = False 
        time.sleep(5)
    #Write address to file
    print("Finished hosting. Once you choose a provider, we will start sending them the file.\r")
    f = open('totalOrderAddress.txt', 'w')
    f.write(totalAddr)
    f.close()

def threadRestarter():
    #for i in range(0,threads):
        #orderAddr.append(0)
    global orderAddr
    print("Hosting file.\r")
    while(True):
        #global orderAddr
        #print("addrs:"+ str(orderAddr))
        try:
            for i in range(0,len(startTimes)):
                global orderAddr
                if time.time() > startTimes[i] + 60 and orderAddr[i] == 0:
                    os.system('rm onionshare' + str(i) + '.txt')
                    #threadL[i]._delete()
                    threadL[i].terminate()
                    f = open("order.txt" , 'r')
                    lines = f.readlines()
                    f.close()
                    #t=threading.Thread(target=startShare,args=[lines[i].strip('\n'),i])
                    t=multiprocessing.Process(target=startShare,args=(lines[i].strip('\n'),i,))
                    threadL[i] = t
                    threadL[i].start()
                    holdVal = startTimes[i]
                    startTimes[i] = time.time()
                    f = open('restart.txt', 'a')
                    f.write("thread:" + str(i) + ' has been restarted at:' + str(time.time()) + ' due to time issue. It started at:'+str(holdVal)+' and should end at:'+str(holdVal+120)+' and addr:'+ str(orderAddr[i])+'\n')
                    f.close()
            for i in range(0,threads):
                if os.path.isfile('onionshare' + str(i) + '.txt' ):
                    f = open('onionshare' + str(i) + '.txt' )
                    lines = f.readlines()
                    for line in lines:
                        if line.find('in use') >= 0:
                            os.system('rm onionshare' + str(i) + '.txt')
                            #threadL[i]._delete()
                            threadL[i].terminate()
                            f = open("order.txt" , 'r')
                            lines = f.readlines()
                            f.close()
                            #t=threading.Thread(target=startShare,args=[lines[i].strip('\n'),i])
                            t=multiprocessing.Process(target=startShare,args=(lines[i].strip('\n'),i,))
                            threadL[i] = t
                            threadL[i].start()
                            startTimes[i] = time.time()
                            f = open('restart.txt', 'a')
                            f.write("thread:" + str(i) + ' has been restarted at:' + str(time.time()) + ' due to address error\n')
                            f.close()
            t = 0
            for i in orderAddr:
                if i != 0:
                    t +=1
            for i in range(0,threads):
                if os.path.isfile('onionshare'+str(i)+'.txt') and orderAddr[i] == 0:
                    f = open('onionshare'+str(i)+'.txt', 'r')
                    lines = f.readlines()
                    f.close()
                    for j in lines:
                        if (j.find("http://onionshare") >= 0): #found address
                            orderAddr[i] = j.strip('\n') + "/" + order[i].strip('\n')
            if t == threads:
                f = open('totalOrder.txt', 'w')
                for i in orderAddr:
                    f.write(i + '\n')
                f.close()

        except:
            pass

        #Print a string with each file's percentage
        toprint = "" 
        for i in range(threads):
            try: #Will fail if index not found, then just ignore
                f = open('onionshare'+str(i)+'.txt', 'r')
                #Get string of percentage for file slice
                wholetext = f.read()
                f.close()
                percentindex = wholetext.rindex("%") #Finds the position of the last percent
                spaceindex = wholetext.rindex(" ", 0, percentindex) #Finds the position of the last space before the percent
                percentage = wholetext[spaceindex+1:percentindex+1] #Skips the space but includes the percent
                toprint += str(i) + ": " + percentage + ("" if i == threads-1 else ", ") #Formats string
            except: pass
        print(toprint + "\r", end="") #recurrent character so it rewrites last line instead of making new lines


        time.sleep(5)


def hostReqFail():
    subprocess.Popen(["script -c \"~/onionshare/dev_scripts/onionshare --website reqFails.txt" + "\" -f reqFailLog.txt"],stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
def reqFail():
    #failThread = threading.Thread(target=hostReqFail)
    failThread = multiprocessing.Process(target=hostReqFail)
    threadOn = False
    global threads
    reqMade = [0]*threads
    callSum = 0
    while True:
        time.sleep(120)
        for i in range(0,threads):
            if os.path.isfile('onionshare' + str(i) + '.txt'):
                f = open('onionshare' + str(i) + '.txt')
                lines = f.readlines()
                f.close()
                for line in lines:
                    if reqMade[i] == 0 and line.find('get') >= 0:
                        reqMade[i] = 1
                        callSum += 1
        if callSum >= (threads/2) and callSum != threads:
            f = open('reqFails.txt', 'w')
            for i in range(0,threads):
                if reqMade[i] == 0:
                    f.write(str(i)+'\n')
            if threadOn:
                #failThread._delete()
                failThread.terminate()
                #failThread = threading.Thread(target=hostReqFail)
                failThread = multiprocessing.Process(target=hostReqFail)
                failThread.start()
                threadOn = True
            else:
                failThread.start()
                threadOn = True
        if callSum == threads:
            #failThread._delete()
            failThread.terminate()
            threadOn = False

def totalThreadRestarter():
    global totalStartTime
    global totalAddr
    global mainThread
    while (True):
        if totalStartTime != 0 and time.time() > totalStartTime + 60 and totalAddr == '':
            os.system('rm onionshareOrder.txt')
            #restart thread
            #mainThread._delete()
            mainThread.terminate()
            #t = threading.Thread(target=shareOrder)
            t = multiprocessing.Process(target=shareOrder)
            mainThread = t
            mainThread.start()
            totalStartTime = time.time()
            f = open('restart.txt', 'a')
            f.write("thread: for totalOrder has been restarted at:" + str(time.time()) + ' due to time issue\n')
            f.close()

def resetHost():
    global threadL
    global orderAddr
    global order
    global startTimes
    global mode
    global lockModeAt
    global fileName
    global totalAddr
    for i in threadL:
        try: #May or may not already be deleted
            #i._delete()
            i.terminate()
        except: pass
    threadL = []
    orderAddr = []
    order   = []
    startTimes = []
    mode = lockModeAt
    totalAddr = ''
    try:
        os.system('rm restart.txt totalOrderAddress.txt totalOrder.txt onionShareOrder.txt onionshare*.txt order.txt image.zip*.txt >/dev/null 2>&1')
    except:
        pass
    fileName = ''
      
    #new memory and command line reset
    os.system("reset")
    os.system("ps aux > ps.txt")
    f = open("ps.txt", 'r')
    line = f.readline()
    while line != '':
        if line.find('onionshare') != -1:
            try:
                os.system('kill -9 ' + line.split()[1] + ' >/dev/null 2>&1')
            except:
                pass
        line = f.readline()
    f.close()
    try:
        os.system('rm ps.txt')
    except:
        pass

def failingCheck():
    global threadL
    while True:
        time.sleep(120)
        positions = []
        try:

            session = r.session()
            session.proxies = {}
            session.proxies['http'] = 'socks5h://localhost:9050'
            session.proxies['https'] = 'socks5h://localhost:9050'

            fails = session.get(totalAddr + '/reqFails.txt')
            f = open('reqFails.txt', 'wb').write(fails.contetn)
            f.close()
            f = open('reqFails.txt', 'r')
            lines = f.readlines()
            f.close()
            for line in lines:
                positions.append(int(line).rstrip())
            f = open('totalOrder.txt', 'r')
            lines = f.readlines()
            for pos in positions:
                #threadL[pos]._delete()
                threadL[pos].terminate()
                #threadL[pos] = threading.Thread(target=getShare,args=[lines[pos].rstrip(),pos])
                threadL[pos] = multiprocessing.Process(target=getShare,args=(lines[pos].rstrip(),pos,))
                threadL[pos].start()
        except:
            pass



#######################################################################################################################################
########################################################request########################################################################
#######################################################################################################################################

def getShare(address, iter):
    global content
    session = r.session()
    session.proxies = {}
    session.proxies['http'] = 'socks5h://localhost:9050'
    session.proxies['https'] = 'socks5h://localhost:9050'

    res = session.get(address) #download file
    #content[iter] = res.content #append this slice's content to total content list


    ########################get key and nonce##################################
    [key, nonce] = getKey("key.txt","nonce.txt")
    ###########################################################################
    
    
    f = open("image.zip" + str(iter) + ".txt","wb" )
    f.write(dec(key, nonce, res.content))
    f.close()
    #print(type("-----Received content from thread " + iter))
    #for i in range(threads):
    #    print(len(content[i]))
    #This thread unneeded now, can safely kill it
    killMe(iter)

def getShareWithoutIter(address):
    session = r.session()
    session.proxies = {}
    session.proxies['http'] = 'socks5h://localhost:9050'
    session.proxies['https'] = 'socks5h://localhost:9050'

    res = session.get(address) #download file

    #########save the zip and unzip it#########
    open("totalOrder.zip", 'wb').write(res.content)
    time.sleep(5)
    os.system("unzip -o totalOrder.zip")
    ###########################################

def createThreadsReq():
    global totalAddr
    global content
    global mode
    flag = True
    flagTwo = True
    flagThree = True
    while flag:
        time.sleep(5)
        #Addresses written to file (Step 2)
        if os.path.isfile("totalOrder.txt") and flagTwo:
            print("Downloading file from host. This may take a while...")
            flagTwo = False
            #Need to make a thread for each address
            f = open("totalOrder.txt", 'r')
            lines = f.readlines()
            f.close()
            j = 0
            for line in lines:
                #t = threading.Thread(target=getShare,args=[line.strip('\n'), j])
                t = multiprocessing.Process(target=getShare,args=(line.strip('\n'), j,))
                threadL.append(t) 
                t.start()
                j += 1
        #Every slot in content has been written to (Step 3)
        # elif not (b'' in content):
        #     #print(content)
        #     #Tell session it has finished

        #     session = r.session()
        #     session.proxies = {}
        #     session.proxies['http'] = 'socks5h://localhost:9050'
        #     session.proxies['https'] = 'socks5h://localhost:9050'

        #     session.get(totalAddr + '/finish') #tell server finished downloading

        #     try:
        #         print(type(content))
        #         print(type(content[0]))
        #         print(type(content[0][0]))
        #     except:
        #         print("hello")

        #     #Save in chunks, converting to bytes
        #     with open("image.zip", "wb") as f:
        #         for i in range(threads):
        #                 f.write(content[i])  

        #     resetReq()
        #     flag = False
        #Every slot in content has been written to (Step 3)
        allVal = True
        for i in range(0,threads):
            if os.path.isfile("image.zip" + str(i) + ".txt"):
                content[i] = True
            else:
                allVal = False
                break
        if allVal:
            if mode == 'user' or mode == 'provider':
                session = r.session()
                session.proxies = {}
                session.proxies['http'] = 'socks5h://localhost:9050'
                session.proxies['https'] = 'socks5h://localhost:9050'

                session.get(totalAddr + '/finish') #tell server finished downloading
            totalFile = open('image.zip', 'wb')
            for i in range(0, threads):
                iterFile = open('image.zip' + str(i) + '.txt', 'rb')
                totalFile.write(iterFile.read())
                iterFile.close()
            totalFile.close()
            flag = False
            resetReq()

        #totalOrder.txt not yet received (Step 1)
        elif flagThree: 
            statF = open("stat.txt", 'r')
            totalAddr = statF.readline().rstrip()
            statF.close()
            #if file ready to be received from worker. totalAddr will hold the .onion address
            if totalAddr != '' and totalAddr != 'Executing' and totalAddr != 'Ready':
                flagThree = False
                getShareWithoutIter(totalAddr) #download totalOrder.txt

def resetReq():
    global content
    global threadL
    global mode
    global mainThread
    global totalAddr
    content = []
    for i in range(threads):
        content.append(False)
        #content.append(b'')#inits list with threads number of empty byte arrays
    #kill all threads before resetting
    for i in threadL:
        try: #May or may not already be deleted
            #i._delete()
            i.terminate()
        except: pass
    threadL = []
    mainThread = None
    totalAddr = None
    mode = ''
    try:
        os.system('rm totalOrder.txt image.zip*.txt')
    except:
      pass
    #new memory and command line reset
    os.system("reset")
    os.system("ps aux > ps.txt")
    f = open("ps.txt", 'r')
    line = f.readline()
    while line != '':
        if line.find('onionshare') != -1:
            try:
                os.system('kill ' + line.split()[1])
            except:
                pass
        line = f.readline()
    f.close()
    f = open('stat.txt', 'w')
    f.close()
    try:
        os.system('rm ps.txt')
    except:
        pass

#kill specified thread
def killMe(iter):
    #threadL[iter]._delete()
    try:
        threadL[iter].terminate()
    except:
        pass

#######################################################################################################################################
#####################################################controller########################################################################
#######################################################################################################################################
def getTime(mess):
    now = datetime.now()
    end = open('log.txt', 'r').readline().rstrip()[24:]
    #print(now.strftime("%a %b %d %Y %H:%M:%S" + end))
    time = now.strftime("%a %b %d %Y %H:%M:%S" + end)
    f = open('log.txt', 'a')
    f.write(time + " "+ mess)
    f.close()

def hostController(file):
    genKey()
    for i in range(0,threads):
        orderAddr.append(0)
    splitFile(file)
    createThreadsHost()
    runThreads()
    errCorr = multiprocessing.Process(target=threadRestarter)
    errCorr.start()
    #getAddrs()
    #failThread = threading.Thread(target=reqFail)
    failThread = multiprocessing.Process(target=reqFail)
    failThread.start()
    #Total share
    global mainThread
    #mainThread = threading.Thread(target=shareOrder)
    mainThread = multiprocessing.Process(target=shareOrder)
    mainThread.start()
    #Restarter for total share
    #errCorrMain = threading.Thread(target=totalThreadRestarter)
    errCorrMain = multiprocessing.Process(target=totalThreadRestarter)
    errCorrMain.start()
    getTotalAddr()
    flag = True
    while flag:
        if os.path.isfile('onionshareOrder.txt'):
            f = open('onionshareOrder.txt', 'r')
            line = f.readline()
            while line != '':
                if "/finish" in line :
                    flag = False
                    try: #May or may not already be deleted
                        #errCorr._delete()
                        errCorr.terminate()
                    except: pass
                    try: #May or may not already be deleted
                        #mainThread._delete()
                        mainThread.terminate()
                    except: pass      
                line = f.readline()
            f.close()
    try: #May or may not already be deleted
        #failThread._delete()
        failThread.terminate()
    except: pass
    resetHost()

def reqController():
    #failThread = threading.Thread(target=failingCheck)
    failThread = multiprocessing.Process(target=failingCheck)
    failThread.start()
    createThreadsReq()
    try: #May or may not already be deleted
        #failThread._delete()
        failThread.terminate()
    except: pass

def dockerExe():
    global mode
    time.sleep(30)
    os.system("unzip image.zip")
    #this will load the image back into docker
    os.system("sudo docker load -i image.tgz")
    #this will start the container in a bash
    os.system("sudo docker run -dit execute:latest bash")

    getTime('Docker Image Loaded and Executing')

    #this will execute the code
    #0 -> Provider
    #1 -> Validator
    mval = 0
    if mode == "validator":
      mval = 1
    os.system("sudo docker exec $(sudo docker container ls -q) python3 execute.py " + str(mval) )
    #this will delete the old image file
    os.system("sudo rm -rf image.tgz")
    #this will update the container
    os.system("sudo docker commit $(sudo docker container ls -q) execute:latest")

    getTime("Execution Finished")

    #this will remove the image to be transmitted to the next step
    os.system("sudo docker save execute -o image.tgz")
    #zip the image
    os.system('sudo zip -0 image.zip image.tgz')
    #this will stop the docker image
    os.system("sudo docker stop $(sudo docker container ls -q)")

    getTime('Image Unloaded and Ready For Transmission')

def getMode():
    global mode
    global lockModeAt
    flag = True
    if lockModeAt != '':
        flag = False
    while flag:
        time.sleep(5)
        if os.path.isfile('mode.txt'): 
            f = open("mode.txt", "r")
            curLine = f.readline().rstrip()
            f.close() 
            if(curLine == "provider" or curLine == 'validator' or curLine == "user"):  
                mode = curLine
                flag = False
                f = open('mode.txt', 'w')
                f.close()



if __name__ == '__main__':
    while True:
        getMode()    
        if mode == 'user':
            resetHost()
            hostController('image.zip')
            flag = True
            while flag:
                f = open('stat.txt', 'r')
                line = f.read()
                f.close()
                if line.find('onionshare') != -1:
                    flag = False
                time.sleep(5)
            try:
                os.system("rm -rf totalOrder.txt totalOrder.zip")
            except:
                pass
            reqController()
        else:
            reqController()
            dockerExe()
            try:
                os.system("rm -rf totalOrder.txt totalOrder.zip")
            except:
                pass
            hostController('image.zip')
