var GPIO = require('pigpio').Gpio;
var mergeJSON = require("merge-json");

// All default configurations, these will be overwritten by the supplied settings
var walkyConf = {
    motor1DirectionOnePin: 5,
    motor1DirectionTwoPin: 6,
    motor2DirectionOnePin: 20,
    motor2DirectionTwoPin: 21,
    ultraSonicTrigger: 16,
    ultraSonicReciver: 24,
    //EventNames
    goFwdEvent: "goFwd", // Client triggered event to go Forward
    goBkdEvent: "goBkd", // Client triggered event to go Backward
    goLftEvent: "goLft", // Client triggered event to go Left
    goRitEvent: "goRit", // Client triggered event to go Right
    stopEvent: "stop", // Client triggered event to Stop
    servingEvent: "serving", // Server triggered event to let client know of socketID controlling walky
    blockDetectEvent: "blockdetected" // Server triggered event to send the front block distance detected 
}

module.exports = function(config){
    config = config || {};
    //Module Initialization
    const MICROSECDONDS_PER_CM = 1e6/34321;
    //Merge default settings with supplied settings
    var cfg = mergeJSON.merge(walkyConf, config);
    var walking = false;
    var currServing = null;
    var blockdist = 0;
    var GPIOInSettings = {
        mode: GPIO.INPUT,
        alert: true
    }   
    var GPIOOutSettings = {
        mode: GPIO.OUTPUT,
        pullUpDown: GPIO.PUD_DOWN,
        edge: GPIO.EITHER_EDGE
    }
    //Initializing GPIO pins 
    var motor1DirectionOnePin = new GPIO(cfg.motor1DirectionOnePin, GPIOOutSettings);
    var motor1DirectionTwoPin = new GPIO(cfg.motor1DirectionTwoPin, GPIOOutSettings);
    var motor2DirectionOnePin = new GPIO(cfg.motor2DirectionOnePin, GPIOOutSettings);
    var motor2DirectionTwoPin = new GPIO(cfg.motor2DirectionTwoPin, GPIOOutSettings);
    var ultraSonicTrigger = new GPIO(cfg.ultraSonicTrigger, GPIOOutSettings);
    var ultraSonicReciver = new GPIO(cfg.ultraSonicReciver, GPIOInSettings);
    (function() {
        let startTick;
        ultraSonicTrigger.digitalWrite(0);
        ultraSonicReciver.on('alert', (level, tick) => {
          if (level == 1) {
            startTick = tick;
          } else {
            const endTick = tick;
            const diff = (endTick >> 0) - (startTick >> 0); // Unsigned 32 bit arithmetic
            blockdist = (diff / 2 / MICROSECDONDS_PER_CM + " CM");
          }
       });
    })();  // Self starting function to calculate block distance in Centi meters
    setInterval(() => {
        ultraSonicTrigger.trigger(10, 1); // Set ultrasonic trigger high for 10 microseconds 
    }, 1000);
    //Module Initialization
    walkyfunc = function(socket){
        console.log("walky connected to " + socket.conn.id);
        setInterval(() => {
            socket.emit(cfg.blockDetectEvent, {blockdistence: blockdist});
        }, 1000);
        socket.on('disconnect',function(){
            if (socket.conn.id == currServing){
                walking = false;
                currServing = null;
                motor1DirectionOnePin.digitalWrite(0);
                motor2DirectionOnePin.digitalWrite(0);
                motor1DirectionTwoPin.digitalWrite(0);
                motor2DirectionTwoPin.digitalWrite(0);
            }
            console.log(socket.conn.id + ' disconnected');
        });
        socket.on(cfg.goFwdEvent, function(data){
            if(!walking){
                walking = true;
                currServing = socket.conn.id;
                motor1DirectionTwoPin.digitalWrite(0);
                motor2DirectionTwoPin.digitalWrite(0);
                motor1DirectionOnePin.digitalWrite(1);
                motor2DirectionOnePin.digitalWrite(1);
            }
            else{
                socket.emit(cfg.servingEvent,{currentServing:currServing});
            }
        });
        socket.on(cfg.goBkdEvent, function(data){
            if(!walking){
                walking = true;
                currServing = socket.conn.id;
                motor1DirectionOnePin.digitalWrite(0);
                motor2DirectionOnePin.digitalWrite(0);
                motor1DirectionTwoPin.digitalWrite(1);
                motor2DirectionTwoPin.digitalWrite(1);
            }
            else{
                socket.emit(cfg.servingEvent,{currentServing:currServing});
            }
        });
        socket.on(cfg.goLftEvent, function(data){
            if(!walking){
                walking = true;
                currServing = socket.conn.id;
                motor1DirectionOnePin.digitalWrite(0);
                motor2DirectionOnePin.digitalWrite(1);
                motor1DirectionTwoPin.digitalWrite(1);
                motor2DirectionTwoPin.digitalWrite(0);
            }
            else{
                socket.emit(cfg.servingEvent,{currentServing:currServing});
            }
        });
        socket.on(cfg.goRitEvent, function(data){
            if(!walking){
                walking = true;
                currServing = socket.conn.id;
                motor1DirectionOnePin.digitalWrite(1);
                motor2DirectionOnePin.digitalWrite(0);
                motor1DirectionTwoPin.digitalWrite(0);
                motor2DirectionTwoPin.digitalWrite(1);
            }
            else{
                socket.emit(cfg.servingEvent,{currentServing:currServing});
            }
        });
        socket.on(cfg.stopEvent, function(data){
            if(walking){
                walking = false;
                currServing = null;
                motor1DirectionOnePin.digitalWrite(0);
                motor2DirectionOnePin.digitalWrite(0);
                motor1DirectionTwoPin.digitalWrite(0);
                motor2DirectionTwoPin.digitalWrite(0);
            }
            else{
                socket.emit(cfg.servingEvent,{currentServing:currServing});
            }
        });
    }

    return walkyfunc;
}


