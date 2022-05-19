import { createServer } from "https";
import { WebSocketServer } from "ws";
import { readFileSync } from "fs";


import { get, has } from "config";
const ping = require("ping").sys.probe;
import chalk  from "chalk";
import Lazy from "lazy.js"
const _ = require('lodash')

var LifxClient = require('lifx-lan-client').Client;
var client = new LifxClient();
var lightsList = [];

const phoneIp = process.env.PHONE_IP
const phoneMAC = process.env.PHONE_MAC

const jsonRaw: any = readFileSync('./config/colors.json')
const colorJSON = JSON.parse(jsonRaw)
const purple = colorJSON.Default
const lavender = colorJSON.Lavender
const red = colorJSON.Red
const pink = colorJSON.Pink
var currentColor = "Purple"

function TransitionColor(Target) {
  Lazy(lightsList)
    .each((light) => {
      light.colorRgbHex(colorJSON[Target], 5000)
  })
  currentColor = Target;
}

const log = console.log
const logerror = console.error

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

var hr = 0;
var wasOnline = false;
var onlineTries = 0;
var maxTries = 5;

const server = createServer({
    key: readFileSync('./ssl/key.pem'),
    cert: readFileSync('./ssl/cert.pem')
})
const wss = new WebSocketServer({server});

wss.on('connection', (ws) => {

  ws.on('message', (data) => {
    /* JSON
      heartrate,
      stress,
      asleep
    */
    if(!data.sleep) {
      const hr = data.heartrate
      switch(true) {
        case _.inRange(hr, 20,39):
          if(currentColor==="Lavender") {
            break
          }
          
          TransitionColor("Lavender")
          log('between 20 to 39')
          break
        case _.inRange(hr, 40,80):
          if(currentColor==="Purple") {
            break
          }

          TransitionColor("Purple")
          log('between 40 to 80')
          break 
        case _.inRange(hr, 81,109):
          if(currentColor==="Pink") {
            break
          }

          TransitionColor("Pink")
          log('between 81 to 109')
          break
        case hr >= 110:
          if(currentColor==="Red") {
            break
          }

          TransitionColor("Red")
          log('above 110+')
          break
        default:
          break
      }
    } else {
      if(currentColor==="Lavender") {
        return
      }
      
      TransitionColor("Lavender")
    };
  });
});

server.listen(6969, () => {
    console.log('Server started at http://localhost:6969')
    
    client.on('light-new', (light) => {
      lightsList.push(light);
      console.log('new light')

      light.colorRgbHex(colorJSON[currentColor], 2000, (err) => {
        if(err) {
          console.log(err)
        }
      })
    })

    client.init({
      debug: false,
      lightOfflineTolerance: 3, // A light is offline if not seen for the given amount of discoveries
      messageHandlerTimeout: 45000, // in ms, if not answer in time an error is provided to get methods
      startDiscovery: true, // start discovery after initialization
      resendPacketDelay: 150, // delay between packages if light did not receive a packet (for setting methods with callback)
      resendMaxTimes: 3, // resend packages x times if light did not receive a packet (for setting methods with callback)
      address: '0.0.0.0', // the IPv4 address to bind the udp connection to
      broadcast: '10.0.0.255', // set's the IPv4 broadcast address which is addressed to discover bulbs
      lights: [], // Can be used provide a list of known light IPv4 ip addresses if broadcast packets in network are not allowed
                  // For example: ['192.168.0.112', '192.168.0.114'], this will then be addressed directly
      stopAfterDiscovery: false, // stops discovery process after discovering all known lights (requires list
                                // of addresses provided with "lights" setting)
      discoveryInterval: 5000, // Interval (in ms) between discovery operations
      messageRateLimit: 1, // The delay (in ms) between sending any two packets to a single light
    
    }, () => {
      log('LIFX Client initialization finished');
    })

    setInterval(() => { ping(phoneIp, (isConnected) => {
        if(isConnected) { wasOnline = true; onlineTries = 0; }

        if(wasOnline && !isConnected) {
          if(onlineTries==maxTries) {
            log('device is actually offline, pog?')
            wasOnline = false;
          } else {
            onlineTries++
            log(
              "Checking if device is actually offline. Tries: " +
              onlineTries
            )
            return
          }
        }
        
        if(!isConnected) {
            lightsList[0].getPower((err, lightStatus) => {
              if(err) { 
                log(err.stack);
                return
              }
              if(!!lightStatus) {
                lightsList.forEach(light => {
                  light.off();
                  setTimeout(async () => await 0, 1000)
                })
                log('phone not connected, turning lights off.')
              }
            })
          } else if(isConnected) {
            lightsList[0].getPower((err, lightStatus) => {
              if(err) { 
                log(err.stack);
                return
              }
              if(!!!lightStatus) {
                lightsList.forEach(light => {
                  light.on();
                  setTimeout(async () => await 0, 1000)
                })
                log('phone is connected, turning lights on')
              }
            })
          }
    })
  }, 5000)
})