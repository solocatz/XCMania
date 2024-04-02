/*
 Copyright_License
 XC Tracer Vario sound editor
 Copyright (C) 2015 Thomas Ruf

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation; either version 2
 of the License, or (at your option) any later version.
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 You should have received a copy of the GNU General Public License
 along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
//debugger;

function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

$(document).ready(function ($) {

    "use strict";
    /*jshint -W083  */
    /*jshint -W084 */

    // the vario data
    var vario = {};
    vario.msIs = 0;		// climb/sink m/s
    vario.msShould = 0;         // target value for climb/sink
    vario.timer = 0;            // active timer function
    vario.tone = null;          // the current tone
    vario.interval = 20;	// the interval of the timer

    vario.cycle = 0;            // cycle time in ms
    vario.duty = 0;		// duty cycle in %
    vario.frequency = 0;	// frequency
    vario.timeToneOn = 0;	// time when cycle started
    vario.toneIsOn = false;
    vario.cycleIsOn = false;
    vario.gainOn = 0.2;         // amp gain when tone is on
    vario.gainUser = vario.gainOn;
    vario.speakerOn = true;
    vario.timeStep = 0.2;	// m/s step per time interval

    // the canvas and context
    var canvasGrid = null;
    var canvasPlot = null;
    var ctxGrid = null;
    var ctxPlot = null;

    // audio
    var oscillator;
    var amp;
    var audioContext = 0;
    var tc = 0.001;

    // the Handsontable objects
    var hot1 = null;
    var hot2 = null;
    var hot3 = null;

    // the vario bar
    var theBar;
    var theCircle;
    var theBarText;

    // mouse framer time
    var mouseTime = 20;

    var linLog = {
        plot: false,
        interpol: false
    };

    // the config data
    var configData = {
        customTones: [],        // the custom tone settings
        thresholdData: [],      // the thresholds for the custom tones
        otherData: [],          // "other" config data
        filename: null,
        editMode: false,
        getFilename: function () {
            return this.filename ? this.filename : "xctracer.txt";
        },
        getFileData: function (cr) {
            var sep = (cr === true) ? "\r\n" : "\n";
            return dumpConfigData().join(sep) + sep +
                    dumpTonesData().join(sep) + sep;
        },
        getCustomText: function () {
            return (
            "# Paste this text into xctracer.txt\n" +
            "varioTone=Custom\n" +
            dumpTonesData().join("\n") ) ;
        }
    };
    // map world coordinates to pixels
    // world:
    // X axis is m/s -10 .. +10
    // Y axis is H 200 .. 2000
    // Y axis is C 10 .. 2000
    // for log2 scaled Y axis
    if (Math.log2 !== 'function')
        Math.log2 = function (number) {
            return Math.log(number) / Math.log(2);
        };
    function clipValue(v,min,max) {
        return Math.min(Math.max(v,min),max);
    }
    var world = {
        mMin: -10,
        mMax: +10,
        hMin: 200,
        hMax: 2000,
        cMin: 10,
        cMax: 2000,
        dMin: 0,
        dMax: 100,
        width: null,
        height: null,
        offsetX: 40,
        offsetY: 45,
        maxDY: 0.3,
        init: function (w, h, log) {
            this.width = w;
            this.height = h;
            this.scaleX = (this.width - 2 * this.offsetX) / (this.mMax - this.mMin);
            this.scaleY = (this.height - 2 * this.offsetY) / (this.hMax - this.hMin);
            this.scaleCY = (this.height - 2 * this.offsetY) / (this.cMax - this.cMin);
            this.scaleDY = this.maxDY * (this.height - 2 * this.offsetY) / (this.dMax - this.dMin);
            this.scaleYlog = (this.height - 2 * this.offsetY) / Math.log2(this.hMax / this.hMin);
            this.hToY = log ? this.hToYlog : this.hToYlin;
            this.yToH = log ? this.yToHlog : this.yToHlin;
        },
        mToX: function (meter) {
            var m = clipValue(meter,this.mMin,this.mMax);
            return Math.round(this.offsetX + (m - this.mMin) * this.scaleX);
        },
        hToYlin: function (hertz) {
            var h = clipValue(hertz,this.hMin,this.hMax);
            return Math.round(this.height - this.offsetY - (h - this.hMin) * this.scaleY);
        },
        hToYlog: function (hertz) {
            var h = clipValue(hertz,this.hMin,this.hMax);
            return Math.round(this.height - this.offsetY - Math.log2(h / this.hMin) * this.scaleYlog);
        },
        cToY: function (cycle) {
            var c = clipValue(cycle,this.cMin,this.cMax);
            return Math.round(this.height - this.offsetY - (c - this.cMin) * this.scaleCY);
        },
        yToC: function (yy) {
            var y = clipValue(yy,this.offsetY,this.height - this.offsetY);
            return Math.round((-(y - this.height + this.offsetY) / this.scaleCY + this.cMin));
        },
        dToY: function (duty) {
            var d = clipValue(duty,this.dMin,this.dMax);
            return Math.round(this.height - this.offsetY - (d - this.dMin) * this.scaleDY);
        },
        yToD: function (yy) {
            var y = clipValue(yy,this.offsetY,this.height - this.offsetY);
            return Math.round((-(y - this.height + this.offsetY) / this.scaleDY + this.dMin));
        },
        xToM: function (xx) {
            var x = clipValue(xx,this.offsetX,this.width - this.offsetX);
            return round2(((x - this.offsetX) / this.scaleX + this.mMin));
        },
        yToHlin: function (yy) {
            var y = clipValue(yy,this.offsetY,this.height - this.offsetY);
            return Math.round((-(y - this.height + this.offsetY) / this.scaleY + this.hMin));
        },
        yToHlog: function (yy) {
            var y = clipValue(yy,this.offsetY,this.height - this.offsetY);
            return Math.round(this.hMin * Math.pow(2, (this.height - this.offsetY - y) / this.scaleYlog));
        },
        clipX: function(x) {
            return clipValue(x,this.offsetX,this.width - this.offsetX);
        },
        clipY: function(y) {
            return clipValue(y,this.offsetY,this.height - this.offsetY);
        }
    };

    function round2(value) {
        return Math.round(value * 100)/100;
    }

    // create new canvas context and attach methods
    function newContext(canvas) {
        if (canvas === null)
            return null;
        var ctx = canvas.getContext("2d");
        if (!ctx)
            return ctx;
        ctx.theCanvas = canvas;
        ctx.moveToTone = function (m, h) {
            this.moveTo(world.mToX(m), world.hToY(h));
        };
        ctx.lineToTone = function (m, h) {
            this.lineTo(world.mToX(m), world.hToY(h));
        };
        ctx.moveToCycle = function (m, c) {
            this.moveTo(world.mToX(m), world.cToY(c));
        };
        ctx.lineToCycle = function (m, c) {
            this.lineTo(world.mToX(m), world.cToY(c));
        };
        ctx.moveToDuty = function (m, d) {
            this.moveTo(world.mToX(m), world.dToY(d));
        };
        ctx.lineToDuty = function (m, d) {
            this.lineTo(world.mToX(m), world.dToY(d));
        };
        return ctx;
    }


    // init everything
    // and check for audio and canvas support

    if (!initAudio()) {
        $("#myH1").append('<h4 class="noaudio">No audio available on this archaic browser.' +
            'Tested with Chrome, FireFox, Opera and Edge.</h4>');
    }

    // setup the canvas, ctx and grid
    canvasGrid = $("#myraster-grid")[0];
    ctxGrid = newContext(canvasGrid);
    canvasPlot = $("#myraster-plot")[0];
    ctxPlot = newContext(canvasPlot);
    if (!ctxGrid) {
        $("#myH1").append('<h4 class="noaudio">No graphics available on this archaic browser.' +
            'Tested with Chrome, FireFox, Opera and Edge.</h4>');
    }


    theBar = $("#mytest-bar");
    theBarText = $("#mytest-text");
    theCircle = $("#mytest-circle");
    doTheResize();

    // resize the canvas, plots etc
    var resizeRequired = false;
    function doTheResize() {
        canvasGrid.width = canvasPlot.width = $("#myraster-grid").parent().outerWidth();
        canvasGrid.height = canvasPlot.height = $("#myraster-plot").parent().outerHeight();
        world.init(canvasGrid.width, canvasGrid.height, linLog.plot);
        drawGrid(ctxGrid, linLog.plot);
        plotAllData(ctxPlot);
        updateVarioBar(true);
        resizeRequired = false;
    }

    // resize triggered by user
    // don't resize immediately, just trigger a timer
    var resizeTimer = null;
    $(window).resize(function () {
        resizeRequired = true;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(doTheResize, 100);
    });

    // draw the grid and axis on the canvas
    function drawGrid(ctx, log) {
        if (!ctx)
            return;
        ctx.clearRect(0, 0, ctx.theCanvas.width, ctx.theCanvas.height);
        ctx.lineWidth = 1;
        ctx.textBaseline = "middle";

        // draw the dots
        // no dot on base line
        ctx.beginPath();
        ctx.strokeStyle = "#aaaaaa";

        function horizDots(h,step) {
            for (var m = world.mMin; m < world.mMax; m += step)
                ctx.rect(world.mToX(m)-0.5, world.hToY(h)+0.5, 1, 1);
        }

        // frequency vertical steps are linear or log2
        var stepL = (false && log) ? 0 : 100;
        var stepM = (false && log) ? Math.pow(2, 1 / 5) : 1;

        for (var h = world.hMin * stepM + stepL; h <= world.hMax; h = h * stepM + stepL)
            horizDots(h,log ? 0.5: 1);

        ctx.stroke();

        ctx.strokeStyle = "#777";
        // vertical axis
        ctx.beginPath();
        ctx.moveToTone(0, world.hMin);
        ctx.lineToTone(0, world.hMax);

        // tick for every 100 Hz
        // not on base line
        for (h = world.hMin * stepM + stepL; h <= world.hMax; h = h * stepM + stepL) {
            ctx.moveToTone(-0.25, h);
            ctx.lineToTone(+0.25, h);
        }

        // horizontal axis
        ctx.moveToTone(world.mMin, world.hMin);
        ctx.lineToTone(world.mMax, world.hMin);
        
        // set m axis ticks at 1 m/s
        ctx.textAlign = "center";
        var size = Math.round(15 / 1000 * ctx.theCanvas.width + 1);
        size = Math.min(size, 16);
        size = Math.max(size, 11);
        ctx.font = size + "px sans-serif";
        var toggle = true;
        for (var i = world.mMin; i <= world.mMax; i += 1) {
            if (toggle || ctx.theCanvas.width >=700)
                ctx.fillText(i + "m/s", world.mToX(i), world.hToY(world.hMin) + 15);
            toggle = !toggle;
            if (!i)
                continue;
            ctx.moveToTone(i, world.hMin);
            ctx.lineToTone(i, world.hMin + (log ? 11 : 40));
        }

        ctx.textAlign = "center";
        ctx.fillText(world.hMin + " Hz",
            world.mToX(0), world.hToY(world.hMin) + 36);
        ctx.fillText(world.hMax / 1000 + " kHz " + (log ? "log2" : "linear"),
            world.mToX(0), world.hToY(world.hMax) - 20);

        // the Duty axis
        size = Math.min(size, 15);
        ctx.font = size + "px sans-serif";
        ctx.moveToDuty(world.mMin, world.dMin);
        ctx.lineToDuty(world.mMin, world.dMax);
        var dY;
        for (i = 25; i <= 100; i += 25) {
            dY = world.dToY(world.dMax/100*i);
            ctx.moveTo(world.offsetX-6, dY );
            ctx.lineTo(world.offsetX+6, dY);
            ctx.fillText(i + "%",world.offsetX-23,dY);
        }
        ctx.fillText("Duty %",world.offsetX-15,dY-23);

        // the Cycle axis
        ctx.moveToCycle(world.mMax, world.cMin);
        ctx.lineToCycle(world.mMax, world.cMax);
        var cX, cY;
        for (i = 200; i <= world.cMax; i += 200) {
            cY = world.cToY(i);
            cX = world.mToX(world.mMax);
            ctx.moveTo(cX-6, cY );
            ctx.lineTo(cX+6, cY);
            ctx.fillText(i,cX+22,cY);
        }
        ctx.fillText("Cycle ms",cX,cY-20);
        ctx.stroke();
    }

    function plotAllData(ctx) {
        if (!ctx)
            return;
        ctx.clearRect(0, 0, ctx.theCanvas.width, ctx.theCanvas.height);
        var tones = dataToTones();
        if (tones.length < 2)
            return;
        plotDutyData(ctx,tones);
        plotThresholds(ctx);
        plotCycleData(ctx,tones);
        plotMeterData(ctx,tones);
    }

    // plot the data on the canvas
    function plotMeterData(ctx,tones) {
        ctx.strokeStyle = "#5292F7";
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveToTone(tones[0].m, tones[0].h);

        for (var i = 1, tone; tone = tones[i]; i++)
                ctx.lineToTone(tone.m, tone.h);
        ctx.stroke();
    }

    // plot the data on the canvas
    function plotCycleData(ctx,tones) {
        ctx.strokeStyle = "#5EAE5E";
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveToCycle(tones[0].m, tones[0].c);

        for (var i = 1, tone; tone = tones[i]; i++)
                ctx.lineToCycle(tone.m, tone.c);
        ctx.stroke();
    }

        // plot the data on the canvas
    function plotDutyData(ctx,tones) {
        ctx.strokeStyle = ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.beginPath();
        ctx.lineWidth = 0;
        ctx.setLineDash([]);
        ctx.moveToDuty(tones[0].m,world.dMin);

        for (var i = 0, tone; tone = tones[i]; i++)
                ctx.lineToDuty(tone.m, tone.d);
        ctx.lineToDuty(tones[i-1].m,world.dMin);
        ctx.closePath();
        //ctx.stroke();
        ctx.fill();
    }

    // plot the threshold ranges as rect
    function plotThresholds(ctx) {
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle="orange";
        var y = world.hToY(world.hMin);
        var h = 12;
        ctx.rect(world.mToX(configData.thresholdData[2].value),y-h,
            world.mToX(configData.thresholdData[3].value) -
            world.mToX(configData.thresholdData[2].value),h);
        ctx.rect(world.mToX(configData.thresholdData[0].value),y-h,
            world.mToX(configData.thresholdData[1].value) -
            world.mToX(configData.thresholdData[0].value),h);
        ctx.stroke();
    }


    // validator for m/s fields
    var msValidator = function (value, callback) {
        callback(value >= world.mMin && value <= world.mMax);
    };

    // validator for duty cycle
    var dutyValidator = function (value, callback) {
        callback(value >= 0 && value <= 100);
    };

    // validator for cycle time
    var cycleValidator = function (value, callback) {
        callback(value >= world.cMin && value <= world.cMax);
    };

    // validator for frequency
    var frequencyValidator = function (value, callback) {
        callback(value >= world.hMin && value <= world.hMax);
    };

    // sort the data and update everything
    var updateAllWithSort = function () {
        // we're still in the constructor
        if (!hot2)
            return;
        configData.customTones.sort(function (a, b) {
            // force numeric compare
            return a.m - b.m;
        });
        updateAll();
    };

    ///////////////////////////////////////////
    // update all plots
    // debounce the updates via AnimationFrame
    ///////////////////////////////////////////

    var requestUpdate = {
        dataHasChanged: false,
        pending: false,
        lastUpdateAll: 0,
        render: false,
        lastRender: 0
    };

    function updateAll(render) {
        requestUpdate.render |= render;
        if (requestUpdate.pending)
            return;
        requestUpdate.pending = true;
        // postpone call to requestAnimationFrame
        // avoids sync force layout ...
        window.setTimeout(function() {
            window.requestAnimationFrame(function() {
                requestUpdate.pending = false;
                updateAllReal();
            });
        },0);
    }

    // update everything, but don't sort the data
    function updateAllReal() {

        //console.log("updateAll: deltaT = ",performance.now()- requestUpdate.lastUpdateAll);
        requestUpdate.lastUpdateAll = performance.now();

        requestUpdate.dataHasChanged = true;
        timingStart();
        plotAllData(ctxPlot);
        //timingShow("plotData");
        updateVarioBar();
        //timingShow("updateVarioBar");

        $("#configtext").val(configData.getCustomText());
        //timingShow("configtext");
        if (requestUpdate.render) {
            requestUpdate.renderCounter++;
            if (requestUpdate.lastUpdateAll - requestUpdate.lastRender < 100) {
                updateAll(true);
            }
            else {
                hot2.render();
                requestUpdate.render = false;
                requestUpdate.lastRender = requestUpdate.lastUpdateAll;
            }
        }
    }


    ////////////////////////////////////
    // create table for thresholds
    // fixed size 4x2, col 0 is readonly
    ////////////////////////////////////
    var $container = $("#mytable1");
    hot1 = new Handsontable($container[0], {
        data: configData.thresholdData,
        colHeaders: ['Threshold', 'm/s'],
        columns: [
            { data: 'name', readOnly: true},
            { data: 'value', type: 'numeric', format: '0,0.00', validator: msValidator}
        ],
        rowHeaders: false,
        contextMenu: ['undo', 'redo'],
        className: "htLeft",
        afterChange: updateAll,
        afterContextMenuHide: updateAll, // work around, required for undo ..
        minRows: 1
    });

    //////////////////////////
    // build tone scale tables
    //////////////////////////
    var keyToPitchMap = {};
    var pitchToKeyMap = {};
    function makeWellTempered() {
        var template = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        var wellTempered = [];
        var n = 0;
        for (var i = 3; i <= 6; i++) {
            $.each(template, function (index, name) {
                var tone = {};
                tone.key = name + i;
                tone.pitch = (Math.pow(2, n / 12) * 130.813).toFixed(0);
                n++;
                keyToPitchMap[tone.key] = tone;

                // give about 0.25% tolerance on pitch ...
                for (var ii = tone.pitch * 0.9975; ii <= tone.pitch * 1.0025; ii++)
                    pitchToKeyMap[ii.toFixed(0)] = tone;
                wellTempered.push(tone);
            });
        }
        // return only valid pitches /*
        return $.grep(wellTempered, function (tone) {
            return tone.pitch >= world.hMin && tone.pitch <= world.hMax;
        });
    }
    // map key to pitch
    function keyToPitch(key) {
        return keyToPitchMap[key] ?
            keyToPitchMap[key].pitch : null;
    }
    // map pitch to key
    function pitchToKey(pitch) {
        return pitchToKeyMap[pitch] ?
            pitchToKeyMap[pitch].key : null;
    }
    var wellTempered = makeWellTempered();
    
    ///////////////////////////////
    // create table for tone values
    ///////////////////////////////
    $container = $("#mytable2");

    hot2 = new Handsontable($container[0], {
        data: configData.customTones,
        colHeaders: ['m/s', 'Hertz', 'Cycle ms', 'Duty %', 'Piano   :'],
        maxRows: 15,
        columns: [
            {data: 'm', type: 'numeric', format: '0,0.00', validator: msValidator},
            {data: 'h', type: 'numeric', format: '0', validator: frequencyValidator},
            {data: 'c', type: 'numeric', format: '0', validator: cycleValidator},
            {data: 'd', type: 'numeric', format: '0', validator: dutyValidator},
            {// HOT in HOT - piano keys
                data: 'key',
                type: 'handsontable',
                handsontable: {
                    data: wellTempered,
                    columns: [{data: 'key', type: 'text'}],
                    colHeaders: false,
                    height: 270,
                    width: 70
                }
            }
        ],
        dataSchema: { m: null, h: null, c: null, d: null, key: null },
        rowHeaders: false,
        afterChange: function (changes, source) {
            // changes format for "edit and "paste":
            // [[ row, prop, oldval, newval ]]
            var change;
            if (changes && (change = changes[0]) &&
                change.length === 4 && change[2] !== change[3]) {
                switch (change[1]) {
                    case "h":
                        hot2.setDataAtRowProp(change[0], 'key', pitchToKey(change[3]));
                        updateAll();
                        break;
                    case "key":
                        if (change[3] === null || change[3] === "")
                            return;
                        hot2.setDataAtRowProp(change[0], 'h', keyToPitch(change[3]));
                        updateAll();
                        break;
                    default:
                        updateAll();
                }
            }

        },
        afterRemoveRow: updateAll,
        afterCreateRow: updateAll,
        afterContextMenuHide: updateAll, // work around, required for undo ..
        width: 350,
        minRows: 1
    });

    // create our own context menu -- we need the sort and clean function
    function isDisabled() {
        return hot2.getSelected()[1] !== 1;
    }
    hot2.updateSettings({
        contextMenu: {
            callback: function (key, options) {
                function upDown(steps) {
                    var h;
                    var factor = Math.pow(2, Math.abs(steps) / 12);
                    if (steps < 0)
                        factor = 1 / factor;
                    h = hot2.getDataAtRowProp(hot2.getSelected()[0], 'h');
                    h *= factor;
                    hot2.setDataAtRowProp(hot2.getSelected()[0], 'h', h.toFixed(0));
                }
                switch (key) {
                    case 'sort':
                        updateAllWithSort();
                        hot2.render();
                        break;
                    case 'clean':
                        // sort it first ...
                        updateAllWithSort();
                        var newData = [];
                        for (var i = 0, tone; tone = configData.customTones[i]; i++) {
                            if (tone.m === null && tone.h === null &&
                                tone.c === null && tone.d === null)
                                continue;
                            newData.push(tone);
                        }
                        configData.customTones = newData;
                        hot2.loadData(configData.customTones);
                        updateAll();
                        hot2.render();
                        break;
                    case 'semiup':
                        upDown(1);
                        break;
                    case 'semidown':
                        upDown(-1);
                        break;
                    case 'wholeup':
                        upDown(2);
                        break;
                    case 'wholedown':
                        upDown(-2);
                        break;
                }
            },
            items: {
                "undo": {},
                "redo": {},
                "row_above": {},
                "row_below": {},
                "remove_row": {},
                "hsep1": "---------",
                "wholeup": {name: 'Whole tone up', disabled: isDisabled},
                "semiup": {name: 'Semitone up', disabled: isDisabled},
                "semidown": {name: 'Semitone down', disabled: isDisabled},
                "wholedown": {name: 'Whole tone down', disabled: isDisabled},
                "hsep2": "---------",
                "sort": {name: 'Sort the Table'},
                "clean": {name: 'Remove empty rows'}
            }
        }
    });

    //////////////////////////////
    // HOT 3 - "other" config data
    //////////////////////////////
    $container = $("#mytable3");
    hot3 = new Handsontable($container[0], {
        data: configData.otherData,
        colHeaders: ['Parameter', 'Value'],
        columns: [
            {data: "command", readOnly: true},
            {data: "args", type: 'text'}
        ],
        colWidths: [180, 180],
        rowHeaders: false,
        contextMenu: true,
        allowInsertColumn: false,
        allowRemoveColumn: false,
        className: "htLeft",
        minRows: 1
    });

    // set cells to dropdown type
    // depending on command keyword
    hot3.updateSettings({
        cells: function (row, col, prop) {
            if (col == 1) {
                var dropdowns = {
                    forwardGPSSentences: ['yes', 'no'],
                    autoFlightDetection: ['yes', 'no'],
                    bluetoothProtocol: ['None', 'XCTRACER', 'LK8EX1',
                        'LXWP0', 'FlyNet', 'BlueFly'],
                    logFormat: ['None', 'IGC', 'KML'],
                    varioTone: ['None', 'XCTRACER', 'BlueFly', 'Custom']
                };
                var cellProperties = {};
                var dropdown = dropdowns[hot3.getDataAtCell(row, 0)];
                if (dropdown) {
                    cellProperties.type = 'dropdown';
                    cellProperties.source = dropdown;
                }
                else
                    cellProperties.type = 'text';
                return cellProperties;
            }
        }
    });

    // read the default data
    configData.defaultConfigFile =
        "# XC Tracer configuration file\n" +
        "\n" +
        "serialNumber=\n" +
        "firmwareVersion=\n" +
        "\n" +
        "# supported Bluetooth protocols are None, XCTRACER, LK8EX1, LXWP0, FlyNet, and BlueFly\n" +
        "bluetoothProtocol=XCTRACER\n" +
        "forwardGPSSentences=no\n" +
        "\n" +
        "# supported log formats are None, IGC, and KML\n" +
        "logFormat=\n" +
        "autoFlightDetection=\n" +
        "pilotName=\n" +
        "passengerName=\n" +
        "gliderType=\n" +
        "gliderId=\n" +
        "\n" +
        "# supported vario tones are None, XCTRACER, and BlueFly\n" +
        "varioTone=Custom \n" +
        "ClimbToneOnThreshold=0.1\n" +
        "ClimbToneOffThreshold=0.05 \n" +
        "SinkToneOnThreshold=-0.7 \n" +
        "SinkToneOffThreshold=-0.6 \n" +
        "tone=-10.0,200,200,100 \n" +
        "tone=-3.0,293,200,100 \n" +
        "tone=-2.0,369,200,100 \n" +
        "tone=-1.0,440,200,100 \n" +
        "tone=-0.5,475,600,100 \n" +
        "tone=0.0,493,600,50 \n" +
        "tone=0.5,550,550,50 \n" +
        "tone=1.0,595,500,50 \n" +
        "tone=2.0,675,400,50 \n" +
        "tone=3.0,745,310,50 \n" +
        "tone=5.0,880,250,50 \n" +
        "tone=10.0,1108,200,50";

    readConfigFile(configData.defaultConfigFile);

    //////////////////////////////////
    // the buttons to select the table
    //////////////////////////////////
    $("#edit-tones").click(function () {
        $("#mytable1").show();
        $("#mytable2").show();
        $("#mytable3").hide();
        $("#edit-tones").addClass("button-active");
        $("#edit-params").removeClass("button-active");
    });

    $("#edit-params").click(function () {
        $("#mytable1").hide();
        $("#mytable2").hide();
        $("#mytable3").show();
        $("#edit-params").addClass("button-active");
        $("#edit-tones").removeClass("button-active");
    });
    $("#edit-tones").click();

    ///////////////////////
    // the lin/log2 buttons
    ///////////////////////
    $("#plot-linlog").click(function () {
        linLog.plot = !linLog.plot;
        $(this).toggleClass("button-active", linLog.plot);
        doTheResize();
        // ooops we're in the plot div
        // ugly but we need to recalc the handle positions
        plotDiv.trigger("mouseleave").trigger("mouseenter");
    });

    $("#interpol-linlog").click(function () {
        linLog.interpol = !linLog.interpol;
        $(this).toggleClass("button-active", linLog.interpol);
        $("#mytest-circle").toggleClass("interpol-log", !! linLog.interpol);
        doTheResize();
    });

    function varioTimerEnable() {
        if (!vario.timer)
            vario.timer = window.setInterval(varioTimer, vario.interval);
        vario.toneIsOn = false;
    }

    function varioTimerDisable() {
        if (vario.timer)
            window.clearInterval(vario.timer);
        vario.timer = null;
        stopTone();
    }


    //////////////////////////////////////////////////
    // divTest is the container of the vario bar
    // set mouse handler and simulate "focus" on click
    //////////////////////////////////////////////////

    var divTest = {
        div: $("#mytest"),
        clickOnElement: null,
        lastPageX: null,
        offsetX: 0      // cache offset to avoid reflow trigger
    };

    // mouse in test field
    divTest.div
        .mouseenter(function (event) {
            // start the timer
            divTest.offsetX = divTest.div.offset().left ;
            varioTimerEnable();
            theCircle.show().data("visible",true);
            $(document).on('keydown.divTest',(function (e) {
                if (!divTest.clickOnElement)
                    return true;
                switch (e.which) {
                    case 32: // Space
                        vario.msShould += e.ctrlKey ? -0.1 : +0.1;
                        return false;
                    case 37:   // Left Arrow
                        vario.msShould -= 0.01;
                        return false;
                    case 39:   // Right Arrow
                        vario.msShould += 0.01;
                        return false;
                }
            }));
        })
        .mouseleave(function (event) {
            // cancel timer and stop tone
            varioTimerDisable();
            divTest.div.removeClass("myclick");
            divTest.clickOnElement = null;
            $(document).off('keydown.divTest');
        })
        .mousemove(function (event) {
            // get the X coordinate and convert to m/s
            // all real work is done in the timer
            // mousemove may fire w/o movement - we must ignore it
            // otherwise it will undo our cursor movements
            var x = event.pageX - divTest.offsetX ;
            if (divTest.lastPageX !== x) {
                var m = world.xToM(x);
                vario.msShould = m;
            }
            divTest.lastPageX = x;
        })
        .click(function (event) {
            divTest.clickOnElement = divTest.div;
            divTest.div.addClass("myclick");
        });

    // speaker on/off
    if (!audioContext)
        $("#myspeaker i").text("warning");
    else {
        $("#myspeaker").click(function () {
            vario.speakerOn = !vario.speakerOn;
            vario.gainUser = vario.speakerOn * vario.gainOn;
            $("#myspeaker i").text(vario.speakerOn ? "volume_up" : "volume_off");
            if (audioContext) {
            	audioContext.resume();
                amp.gain.setTargetAtTime(amp.gain.value ?
                    vario.gainUser : 0, audioContext.currentTime, tc);
            }
        });

        $("#myspeaker").trigger("click");
    }

    ////////////////////////////////////
    // plot div
    // mouse handling
    ////////////////////////////////////
    var mouseTrace = "";
    var plotDiv = $("#myplotdiv");
    var crosshair = new Crosshair(plotDiv,{ marginX: world.offsetX, marginY: world.offsetY });

    function Crosshair(div, options) {
        this.horiz = $('<div class="crosshair-horiz">').prependTo(div);
        this.vert = $('<div class="crosshair-vert">').prependTo(div);
        this.posX = this.vert[0].style;
        this.posY = this.horiz[0].style;
        this.div = div;
        this.marginX = this.marginY = 0;

        for (var key in options) {
            if ($.inArray(key,['marginX','marginY']) >= 0)
                this[key] = options[key];
        }

        this.show = function() {
            this.vert.css({top: this.marginY, height: this.div.height() - 2*this.marginY});
            this.horiz.css({left: this.marginX, width: this.div.width() - 2*this.marginX});
            this.vert.show();
            this.horiz.show();
        };

        this.hide = function() {
            this.vert.hide();
            this.horiz.hide();
        };
        this.setX = function(x) {
            this.posX.left = x + "px";
        };
        this.setY= function(y) {
            this.posY.top = y + "px";
        };
    }

    // setup the plot div for mouse editing
    plotDiv.mouseenter(function (event) {
        // use event framing to improve performance
        var frame = { active: false, target: null};		// the event frame
        $(this).data("frame",frame);

        // resize may still be pending
        if (resizeRequired)
            doTheResize();

        var tones = dataToTones();
        // create enough handles ...
        var hDiv = $(".myplot-handle:first");
        while ($(".myplot-handle").length < tones.length * 3)
            hDiv.after(hDiv.clone());

        // setup all mouse functions
        // use one mouse function for all handles
        var mousedown, mousemove, mouseup;
        mouseTrace = "";
        var mouseTimer = function () {
            mouseTrace += "t";
            var m = world.xToM(frame.thisX);
            var h = frame.data.worldConvertFromY(frame.thisY);
            // don't use hot2.setDataAtRowProp() -- it's extremely slow
            // set values in data and re-render the whole table in animationTimer
            var row = hot2.getData()[frame.data.index];
            row[frame.data.row] = h;
            row.m = m;
            if (frame.data.row === 'h')
                row.key = pitchToKey(h);
            updateAll(true);    
            if (frame.active)
                frame.timer = window.setTimeout(mouseTimer, mouseTime);
        };
        mousedown = function (event) {
            mouseTrace += "d";
            if (!$(this).hasClass("moveable"))
                return true;
            frame.active = true;
            frame.target = $(this);
            // precalculate/set as much as possible on mouse down
            // to minimize execution time in move & timer
            frame.data = frame.target.data("mydata");
            var pdOffset = plotDiv.offset();
            var tgOffset = frame.target.offset();
            frame.targetOuterWidth2 = frame.target.outerWidth(true)/2;
            frame.targetOuterHeight2 = frame.target.outerHeight(true)/2;
            // deltaX/Y - must be subtracetd from pageX/Y to get the center of the click
            frame.deltaX = pdOffset.left + (event.pageX - tgOffset.left - frame.targetOuterWidth2);
            frame.deltaY = pdOffset.top + (event.pageY - tgOffset.top - frame.targetOuterHeight2);
            // thisX/Y must be initialized to use it if movement is restricted to X or Y only
            frame.thisX = event.pageX - frame.deltaX;
            frame.thisY = event.pageY - frame.deltaY;
            frame.target.css("z-index",10);


            crosshair.setX(frame.thisX);
            crosshair.setY(frame.thisY);
            crosshair.show();

            if (!frame.timer)
                frame.timer = window.setTimeout(mouseTimer, mouseTime);
            varioTimerEnable();
            return false;
        };
        mousemove = function (event) {
            mouseTrace += "m";
            if (!frame.active)
                return false;

            // clip x/y to´permitted range
            var thisX = world.clipX(event.pageX - frame.deltaX);
            var thisY = world.clipY(event.pageY - frame.deltaY);
            thisY = Math.max(thisY,frame.data.maxY);
            if (!event.shiftKey) {
                frame.target.css({top: thisY - frame.targetOuterHeight2});
                frame.thisY = thisY;
                crosshair.setY(thisY);
            }
            if (!event.ctrlKey || event.shiftKey) {
                frame.target.css({left: thisX - frame.targetOuterWidth2});
                // move the 2nd target on the X axis
                frame.data.target2nd.css({left: thisX - frame.targetOuterWidth2});
                frame.data.target3rd.css({left: thisX - frame.targetOuterWidth2});
                frame.thisX = thisX;
                crosshair.setX(thisX );
            }
            return false;
        };
        mouseup = function (event) {
            mouseTrace += "u";
            if (!frame.active)
                return;
            frame.active = false;
            frame.target.css("z-index",frame.data.zIndex);
            window.clearTimeout(frame.timer);
            frame.timer = null;
            mouseTimer();       // make the final move
            varioTimerDisable();
            crosshair.hide();
        };

        // setup the handle per tone
        $(".myplot-handle").each(function (index, h) {
            if (index >= tones.length * 3)
                return;

            var tone = tones[index % tones.length];
            var line = Math.floor(index / tones.length);
            var handle = $(this);
            var data = {};
            data.row = ['h', 'c', 'd'][line];

            switch (line) {
            case 0:
                data.worldConvertToY = world.hToY.bind(world);
                data.worldConvertFromY = world.yToH.bind(world);
                data.maxY = world.hToY(world.hMax);
                break;
            case 1:
                data.worldConvertToY = world.cToY.bind(world);
                data.worldConvertFromY = world.yToC.bind(world);
                data.maxY = world.cToY(world.cMax);
                break;
            case 2:
                data.worldConvertToY = world.dToY.bind(world);
                data.worldConvertFromY = world.yToD.bind(world);
                data.maxY = world.dToY(world.dMax);
                break;
            }
            data.target2nd = $($(".myplot-handle")[(index + tones.length) % (3 * tones.length)]);
            data.target3rd = $($(".myplot-handle")[(index + 2*tones.length) % (3 * tones.length)]);
            handle.css('left', world.mToX(tone.m) - handle.outerWidth(true) / 2);
            handle.css('top', data.worldConvertToY(tone[data.row]) - handle.outerHeight(true) / 2);
            data.zIndex = 5 - line;
            handle.css("z-index",data.zIndex);
            data.index = tone.index;
            handle.data("mydata", data);
            handle.addClass("moveable");
            handle.addClass( ["handle-blue", "handle-red", "handle-grey"][line]);
            handle.show().find("*").show();
        });
        // set the mouse handler
        $(this).on("vmousedown", ".moveable", mousedown);
        $(this).on("vmouseup",mouseup).on("vmousemove",mousemove);
        frame.mouseup = mouseup;
    })
        .mouseleave(function (event) {
            mouseTrace += "l";
            // get the frame
            // if null we're in the wrong context
            // can happen after initial page load
            // e.g. leave the plotDiv after load w/o entering it ....
            var frame = $(this).data("frame");
            if (!frame)
                return;
            $(this).data("frame",null);
            frame.mouseup();
            $(this).off('vmousedown').off('vmousemove').off('vmouseup');
            $(".myplot-handle").hide().removeClass("moveable")
                .removeClass("handle-red").removeClass("handle-blue")
                .removeClass("handle-grey");
            //console.log("Trace:",mouseTrace);
        });

    ////////////////
    // the vario bar
    ////////////////
    function updateVarioBar(force) {
        var tone = force ? getToneFromMs(vario.msIs) : vario.tone;
        if (!tone || !theCircle.data("visible"))
            return;
        var center = world.mToX(0);
        if (tone.m >= 0) {
            theBar.css({left: center,
                width: world.mToX(tone.m) - center})
                .addClass("bar-green")
                .removeClass("bar-red");
        }
        else {
            theBar.css({left: world.mToX(tone.m),
                width: center - world.mToX(tone.m)})
                .removeClass("bar-green")
                .addClass("bar-red");
        }
        theCircle.css({left: world.mToX(tone.m) - theCircle.outerWidth()/2,
            top: world.hToY(tone.h) - theCircle.outerHeight()/2 });
        theBarText.html((+tone.m).toFixed(2) + "m/s &mdash; " + tone.h + "Hz " +
            tone.c + "ms " + tone.d + "%");
    }

    // the vario timer function
    // run every 20mS
    // change the climb rate (low pass filter on mouse movement)
    // calculate the current climb rate
    // set the current row in the tone data
    // display the vario bar
    // check thresholds to enable/disable tone
    // tone duty cycle on/off
    function varioTimer() {
        // ramp the ms to target value
        if (requestUpdate.dataHasChanged || !vario.toneIsOn || vario.msIs !== vario.msShould) {
            if (vario.msIs < vario.msShould) {
                vario.msIs += vario.timeStep;
                if (vario.msIs >= vario.msShould)
                    vario.msIs = vario.msShould;
            }
            else if (vario.msIs > vario.msShould) {
                vario.msIs -= vario.timeStep;
                if (vario.msIs <= vario.msShould)
                    vario.msIs = vario.msShould;
            }
            var tone  = getToneFromMs(vario.msIs);

            // set row in table
            if (vario.row !== tone.index) {
                hot2.selectCell(tone.index, 0, tone.index, 4, true, false);
                vario.row = tone.index;
                // focus back to vario bar
                if (divTest.clickOnElement)
                    divTest.clickOnElement.click();
            }

            // update the vario bar
            if (!vario.tone ||
                vario.tone.m != tone.m || vario.tone.h != tone.h ||
                vario.tone.c != tone.c) {
                vario.tone = tone;
                updateVarioBar();
            }

            // check the thresholds
            if (!vario.toneIsOn) {
                // tone is off - enable if outside of on range
                if (tone.m >= configData.thresholdData[0].value || tone.m <= configData.thresholdData[2].value)
                    vario.toneIsOn = true;
            }
            else {
                // tone is on - disable if within off range
                if (tone.m >= configData.thresholdData[3].value && tone.m <= configData.thresholdData[1].value)
                    vario.toneIsOn = false;
            }

            // set the tone ...
            if (vario.toneIsOn)
                startTone(tone.h, tone.c, tone.d);
            else
                stopTone();
        }

        // allow special case: cyle == 0
        if (vario.toneIsOn && audioContext && vario.frequency) {
            // do the duty cycle
            // ignore cycle if >= 99
            var now = audioContext.currentTime;

            if (!vario.cycleIsOn && vario.duty > 0 && (now - vario.timeToneOn) >= vario.cycle / 1000) {
                vario.cycleIsOn = true;
                vario.timeToneOn = now;
                amp.gain.setTargetAtTime(vario.gainUser, now, tc);

                /* 
                 * use the audio subsystem for very short pulses
                 * cut off tone after duty time
                 */
                var ontime = vario.cycle * vario.duty / 100;
                if (ontime < vario.interval * 0.95) {
                    ontime = Math.max(ontime,5);
                    amp.gain.setTargetAtTime(0, now + ontime/1000, tc);
                }
            }
            else if (vario.cycleIsOn && vario.cycle && vario.duty < 99 &&
                (now - vario.timeToneOn) >= vario.cycle / 1000 * vario.duty / 100) {
                vario.cycleIsOn = false;
                amp.gain.setTargetAtTime(0, now, tc);
            }
        }
        requestUpdate.dataHasChanged = false;
    }

    // get tones from the table data
    // ignore empty rows
    // sort the data by m/s
    function dataToTones() {
        //var tones = configData.customTones.slice();
        var tones = $.grep(configData.customTones, function (tone, index) {
            tone.index = index;
            return 'm' in tone && tone.m !== null && tone.m !== "";
        });
        tones.sort(function (a, b) {
            // force numeric compare
            return a.m - b.m;
        });
        return tones;
    }

    function getToneFromMs(m) {
        var tones = dataToTones();
        var tone = {m: round2(m), h: 0, c: 0, d: 0, index:0 };
        var n = tones.length;

        // handle all the corner cases first
        if (!n)
            return tone;
        // only one tone or "left" of 1st tone
        if (n === 1 || m < tones[0].m) {
            tone.h = tones[0].h;
            tone.c = tones[0].c;
            tone.d = tones[0].d;
            tone.index = tones[0].index;
            return tone;
        }
        // "right" of last tone
        if (m >= tones[n - 1].m) {
            tone.h = tones[n - 1].h;
            tone.c = tones[n - 1].c;
            tone.d = tones[n - 1].d;
            tone.index = tones[n - 1].index;
            return tone;
        }

        var row;
        for (row = 0; row < n - 1; row++) {
            if (m < tones[row + 1].m)
                break;
        }
        var tone1 = tones[row];
        var tone2 = tones[row + 1];
        var scale = (m - tone1.m) / (tone2.m - tone1.m);

        // interpolate the values
        if (linLog.interpol)
            tone.h = tone1.h * Math.pow(2, scale * Math.log2(tone2.h / tone1.h));
        else
            tone.h = +tone1.h + scale * (tone2.h - tone1.h);
        tone.c = +tone1.c + scale * (tone2.c - tone1.c);
        tone.d = +tone1.d + scale * (tone2.d - tone1.d);

        // round to int
        tone.h = Math.round(tone.h);
        tone.c = Math.round(tone.c);
        tone.d = Math.round(tone.d);
        tone.index = tone1.index;

        return tone;
    }

    /////////////////////////////////////////
    // Create an oscillator and an amplifier.
    /////////////////////////////////////////
    function initAudio()
    {
        // does this browser support audio ?
        if (typeof window.AudioContext !== 'function') {
            audioContext = 0;
            return false;
        }
        audioContext = new AudioContext();

        // create oscilator, set type
        // create amp
        oscillator = audioContext.createOscillator();
        oscillator.frequency.value = 440;
        oscillator.type = 'square';
        amp = audioContext.createGain();
        amp.gain.value = 0;

        // Connect oscillator to amp and amp to the mixer of the audioContext.
        oscillator.connect(amp);
        amp.connect(audioContext.destination);
        oscillator.start(0);
        return true;
    }

    //  Set the frequency of the oscillator and start it running.
    function startTone(frequency, cycle, duty) {
        // allow special case: cyle == 0
        if (!audioContext || !frequency || !duty)
            return;
        if (vario.frequency != frequency) {
            vario.frequency = frequency;
            oscillator.frequency.value = frequency;
        }

        if (!vario.timeToneOn && vario.duty > 0) {
            var now = audioContext.currentTime;
            vario.cycleIsOn = true;
            vario.timeToneOn = now;
            amp.gain.setTargetAtTime(vario.gainUser, now, tc);
        }

        vario.duty = duty;
        vario.cycle = cycle;
    }

    function stopTone() {
        if (!audioContext)
            return;
        if (vario.frequency || vario.timeToneOn) {
            amp.gain.setTargetAtTime(0, audioContext.currentTime, tc);
        }
        vario.frequency = 0;
        vario.timeToneOn = 0;
    }

    /////////////////////////////////////////////////
    // set the drop zone for dragging the config file
    /////////////////////////////////////////////////
    var dropZone = $('#dropZone,#xxconfigarea');

    // Show the copy icon when dragging over
    // dragover seems to be more reliable than dragenter

    $(window.document).on('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'none';
    });

    dropZone.on('dragover', function (e) {

        e.stopPropagation();
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'copy';
        $(dropZone).addClass("myclick");
        $("#dropIcon").addClass("text-blue");
    });

    dropZone.on('dragleave', function (e) {
        $(dropZone).removeClass("myclick");
        $("#dropIcon").removeClass("text-blue");
    });

    // Get file data on drop
    dropZone.on('drop', function (e) {
        e.stopPropagation();
        e.preventDefault();
        $(dropZone).removeClass("myclick");
        $("#dropIcon").removeClass("text-blue");

        // has text been dropped ?
        // spec says "text/plain" but that fails on IE11
        // "text" seems to work cross browser
        var data = e.originalEvent.dataTransfer.getData('text');
        if (data && data !== "" ) {
            var n;
            if (n = readConfigFile(data)) {
                updateFileInfo("Data set by Drag & Drop <" + n + " line(s)>");
                return;
            }
            $("#dragtext").text("Drag & Drop: no valid data");
            return;
        }

        // has a file been dropped ?
        var files = e.originalEvent.dataTransfer.files; // Array of all files
        for (var i = 0, file; file = files[i]; i++) {
            // must be a text file
            if (!file.type.match(/text\/plain/)) {
                $("#dragtext").text(file.name + ": <no text file>");
                continue;
            }
            var reader = new FileReader();
            // Closure to capture the file information
            reader.onload = (function (theFile) {
                return function (e2) { // finished reading file data.
                    fileLoaded(theFile.name,e2.target.result);
                };
            })(file);
            reader.readAsText(file); // start reading the file data
        }
    });


    ///////////////
    // paste
    ///////////////
    $('#configarea').on('paste', function (e) {
        if (configData.editMode)
            return;
        e.preventDefault();
        var data = null;
        if (typeof e.originalEvent.clipboardData === 'object')
            data = e.originalEvent.clipboardData.getData('text/plain');
        else if (typeof window.clipboardData === 'object')
            data = window.clipboardData.getData('Text');
        if (data && data !== "" ) {
            var n;
            if (n = readConfigFile(data))
                updateFileInfo("Text pasted <" + n + " line(s)>");
        }
    });

    function fileLoaded(name,data) {
        var n = readConfigFile(data);
        configData.filename = name.split('/').pop();
        var text = "File: <strong>" + configData.filename + "</strong>";
        text = text + (n ? " &lt;ok&gt;" : " &lt;no data&gt;");
        updateFileInfo(text);
    }

    function updateFileInfo(text) {
        $("#dragtext").html(text);
        updateAllWithSort();
        $(window).trigger('resize');
    }

    /////////////////////////////
    // create the download button
    /////////////////////////////
    $("#mydownloadbutton").mouseenter(function () {
        $("#save-form").attr("action", "download.php");
        var submitData = {};
        submitData.config = configData.getFileData(true);
        submitData.filename = configData.getFilename();
        var json = JSON.stringify(submitData);
        $("#mybuttondownload").attr("name", "json").attr("type", "submit")
            .attr("value", window.btoa(encodeURIComponent(json)));
    });

    ////////////////////////////
    // text edit the config file
    ////////////////////////////
    $("#edit-config").click(function() {
        configData.editMode = !configData.editMode;
        $('#configtext').prop('readonly',!configData.editMode);
        $(this).toggleClass("button-active",configData.editMode);
        $('#configarea').toggleClass("edit-big",configData.editMode);
        $('#configtext').toggleClass("edit-big",configData.editMode);
        if (configData.editMode) {
            $("#configtext").val(configData.getFileData());
            $('#save-form').hide();
            $('#cover-div').show().fadeTo('slow',0.2);
        }
        else {
            $('#cover-div').fadeTo(400,0.0, function() { $(this).hide() ; } );
            $('#save-form').show();
            var newText = $("#configtext").val();
            if (newText !== configData.getFileData()) {
                var n;
                if (n = readConfigFile(newText,true))
                    updateFileInfo("Text edit <" + n + " line(s)>");
            }
            $("#configtext").val(configData.getCustomText());
        }
    });

    ////////////////
    // the file menu
    ////////////////
    $.ajax( {url: "filemenu.json", dataType: "json" } ).success(function(filemenu) {
        for (var i = 0 ; i < filemenu.items.length; i++)
            $("#filemenu").append("<li>" + filemenu.items[i].menu);
        $("#filemenu li").click(function() {
            var index = $(this).parent().children().index(this);
            $.ajax( {url: filemenu.items[index].url, dataType: "text" } ).success(function(data) {
                fileLoaded(this.url,data);
            });
        });
    });
    
    // pageview counter
    $.ajax( {url: "pageviews.php", dataType: "json"} ).success(function(data) {
        $("#pageviews").html($("#pageviews").html() + " Pageviews: " + data.pageviews );
    });

    // read the config file data
    function readConfigFile(contents,force) {
        // split into lines
        var lines = contents.split(/\r?\n/);
        var nlines = 0;

        var allTones = [];
        var prologue = [];
        var otherData = [];
        var allThresholds = [
            { name: "ClimbToneOnThreshold", value: "" },
            { name: "ClimbToneOffThreshold", value: "" },
            { name: "SinkToneOnThreshold", value: "" },
            { name: "SinkToneOffThreshold", value: "" }
        ];
        for (var i = 0, line; i < lines.length; i++) {
            line = lines[i];
            var match = line.match(/\s*(\w+)\s*=\s*(.*)/);
            if (!match || match.length !== 3) {
                prologue.push(line);
                continue;
            }
            if (match && match.length === 3) {
                var command = match[1].trim();
                var args = match[2].split(',');

                switch (command) {
                    case allThresholds[0].name:
                        if (args.length >= 1) {
                            allThresholds[0].value = +args[0];
                            nlines++;
                        }
                        break;
                    case allThresholds[1].name:
                        if (args.length >= 1) {
                            allThresholds[1].value = +args[0];
                            nlines++;
                        }
                        break;
                    case allThresholds[2].name:
                        if (args.length >= 1) {
                            allThresholds[2].value = +args[0];
                            nlines++;
                        }
                        break;
                    case allThresholds[3].name:
                        if (args.length >= 1) {
                            allThresholds[3].value = +args[0];
                            nlines++;
                        }
                        break;
                    case "tone":
                        // convert to obj
                        // force numerical
                        var tone = {};
                        var n = args.length;
                        tone.m = n >= 1 ? args[0] : 0;
                        tone.h = n >= 2 ? args[1] : 0;
                        tone.c = n >= 3 ? args[2] : 0;
                        tone.d = n >= 4 ? args[3] : 100;
                        tone.key = pitchToKey(tone.h);
                        allTones.push(tone);
                        break;
                    default:
                        otherData.push({
                            command: command,
                            args: match[2],
                            prologue: prologue
                        });
                        prologue = [];
                        break;
                }
            }
        }

        // if file contains data
        // update only the table with new data
        if (nlines || force === true) {
            configData.thresholdData = allThresholds;
            hot1.loadData(configData.thresholdData);
            hot1.render();
        }
        if (allTones.length || force === true) {
            configData.customTones = allTones;
            hot2.loadData(configData.customTones);
            hot2.render();
            updateAll();
        }
        if (otherData.length || force === true) {
            configData.otherData = otherData;
            hot3.loadData(configData.otherData);
            hot3.render();
        }
        // return number of lines with valid data
        return nlines + allTones.length + configData.otherData.length;
    }

    function numToStr(num, fixed) {
        if (typeof num === "number")
            return num.toFixed(fixed);
        else if (typeof num === "string")
            return num;
        else
            return "null";

    }

    // convert the "other" config data into an array of strings
    function dumpConfigData() {
        var text = [];
        for (var i = 0, data; data = configData.otherData[i]; i++) {
            if (!('command'in data) || data.command === null || data.command === "")
                continue;
            var ii, pro;

            for (ii = 0; 'prologue' in data && ii < data.prologue.length; ii++)
                text.push(data.prologue[ii]);
            text.push(data.command + "=" + (data.args ? data.args : ""));
        }
        return text;
    }
    // convert the tones config data into an array of strings
    function dumpTonesData() {
        var text = [];
        var i, tone, data;

        for (i = 0, data; data = configData.thresholdData[i]; i++)
            text.push(data.name + "=" + data.value);

        var tones = dataToTones();
        for (i = 0, tone; tone = tones[i]; i++) {
            var line = "tone=" + numToStr(tone.m, 2) + "," +
                numToStr(tone.h, 0) + "," +
                numToStr(tone.c, 0) + "," + tone.d;
            text.push(line);
        }
        return text;
    }

    var perfTime;
    function timingStart() {
        perfTime = performance.now();
    }

    function timingShow(text) {
        console.log("Timing: ", text ? text : "", (performance.now() - perfTime).toFixed(4), "ms");
        perfTime = performance.now();
    }
});