#!/bin/bash

killall node
cd /home/ec2-user/CodeRacer/coderacerapp/
nohup npm start& > ../serverLog
