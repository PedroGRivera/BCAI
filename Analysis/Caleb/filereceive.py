import time
import gc
from flask import Flask
import requests as r
import json
app = Flask(__name__)

#this script will request each file 100 time

gc.enable()
filenames = ["1MB.txt", "10MB.txt", "100MB.txt", "1GB.txt"]
for j in range(0, 4):
    times = []
    for i in range(0, 99): #100 iterations
        start = int(round(time.time() * 1000))
        res = r.get('http://130.39.223.54/files?filename=' + filenames[j])
        timetaken = int(round(time.time() * 1000)) - start
        times.append(timetaken)
    for i in range(0, 99): #make sum so we can find average
        sum += times[i]
    print("Avg time taken for " + filenames[j] + ": " + str(sum / 100) + " milliseconds")

if __name__ == '__main__':
    app.run(host='0.0.0.0', threaded=False)