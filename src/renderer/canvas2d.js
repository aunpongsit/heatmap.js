
var Canvas2dRenderer = (function Canvas2dRendererClosure() {

  var _getColorPalette = function(config) {
    var gradientConfig = config.gradient || config.defaultGradient;
    var paletteCanvas = document.createElement('canvas');
    var paletteCtx = paletteCanvas.getContext('2d');

    paletteCanvas.width = 256;
    paletteCanvas.height = 1;

    var gradient = paletteCtx.createLinearGradient(0, 0, 256, 1);
    for (var key in gradientConfig) {
      gradient.addColorStop(key, gradientConfig[key]);
    }

    paletteCtx.fillStyle = gradient;
    paletteCtx.fillRect(0, 0, 256, 1);

    return paletteCtx.getImageData(0, 0, 256, 1).data;
  };

  var _getIntensityTemplate = function(radius, blurFactor, value) {
    var tplCanvas = document.createElement('canvas');
    var tplCtx = tplCanvas.getContext('2d');
    var x = radius;
    var y = radius;
    tplCanvas.width = tplCanvas.height = radius*2;

    if (blurFactor == 1) {
      tplCtx.beginPath();
      tplCtx.arc(x, y, radius, 0, 2 * Math.PI, false);
      tplCtx.fillStyle = 'rgb(' + value + ',0,0)';
      tplCtx.fill();
    } else {
      var gradient = tplCtx.createRadialGradient(x, y, radius * blurFactor, x, y, radius);
      gradient.addColorStop(0, 'rgb(' + value + ',0,0)');
      gradient.addColorStop(1, 'rgb(0,0,0)');
      tplCtx.fillStyle = gradient;
      tplCtx.fillRect(0, 0, 2 * radius, 2 * radius);
    }

    return tplCanvas;
  };

  var _getPointTemplate = function(radius, blurFactor) {
    var tplCanvas = document.createElement('canvas');
    var tplCtx = tplCanvas.getContext('2d');
    var x = radius;
    var y = radius;
    tplCanvas.width = tplCanvas.height = radius*2;

    if (blurFactor == 1) {
      tplCtx.beginPath();
      tplCtx.arc(x, y, radius, 0, 2 * Math.PI, false);
      tplCtx.fillStyle = 'rgba(0,0,0,1)';
      tplCtx.fill();
    } else {
      var gradient = tplCtx.createRadialGradient(x, y, radius*blurFactor, x, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      tplCtx.fillStyle = gradient;
      tplCtx.fillRect(0, 0, 2*radius, 2*radius);
    }



    return tplCanvas;
  };

  var _prepareData = function(data) {
    var renderData = [];
    var min = data.min;
    var max = data.max;
    var radi = data.radi;
    var data = data.data;

    var xValues = Object.keys(data);
    var xValuesLen = xValues.length;

    while(xValuesLen--) {
      var xValue = xValues[xValuesLen];
      var yValues = Object.keys(data[xValue]);
      var yValuesLen = yValues.length;
      while(yValuesLen--) {
        var yValue = yValues[yValuesLen];
        var value = data[xValue][yValue];
        var radius = radi[xValue][yValue];
        renderData.push({
          x: xValue,
          y: yValue,
          value: value,
          radius: radius
        });
      }
    }

    return {
      min: min,
      max: max,
      data: renderData
    };
  };


  function Canvas2dRenderer(config) {
    var container = config.container;
    var faceCanvas = this.faceCanvas = document.createElement('canvas');
    var edgeCanvas = this.edgeCanvas = document.createElement('canvas');
    var canvas = this.canvas = config.canvas || document.createElement('canvas');
    var renderBoundaries = this._renderBoundaries = [10000, 10000, 0, 0];

    var computed = getComputedStyle(config.container) || {};

    canvas.className = 'heatmap-canvas';

    this._width = canvas.width = edgeCanvas.width = faceCanvas.width = config.width || +(computed.width.replace(/px/,''));
    this._height = canvas.height = edgeCanvas.height = faceCanvas.height = config.height || +(computed.height.replace(/px/,''));

    this.faceCtx = faceCanvas.getContext('2d');
    this.edgeCtx = edgeCanvas.getContext('2d');
    this.ctx = canvas.getContext('2d');

    // @TODO:
    // conditional wrapper

    canvas.style.cssText = edgeCanvas.style.cssText = faceCanvas.style.cssText = 'position:absolute;left:0;top:0;';

    container.style.position = 'relative';
    container.appendChild(canvas);

    this._palette = _getColorPalette(config);
    this._templates = {};

    this._setStyles(config);
  };

  Canvas2dRenderer.prototype = {
    renderPartial: function(data) {
      if (data.data.length > 0) {
        this._drawAlpha(data);
        this._colorize();
      }
    },
    renderAll: function(data) {
      // reset render boundaries
      this._clear();
      if (data.data.length > 0) {
        this._drawAlpha(_prepareData(data));
        this._colorize();
      }
    },
    _updateGradient: function(config) {
      this._palette = _getColorPalette(config);
    },
    updateConfig: function(config) {
      if (config['gradient']) {
        this._updateGradient(config);
      }
      this._setStyles(config);
    },
    setDimensions: function(width, height) {
      this._width = width;
      this._height = height;
      this.canvas.width = this.edgeCanvas.width = this.faceCanvas.width = width;
      this.canvas.height = this.edgeCanvas.height = this.faceCanvas.height = height;
    },
    _clear: function() {
      this.faceCtx.clearRect(0, 0, this._width, this._height);
      this.edgeCtx.clearRect(0, 0, this._width, this._height);
      this.ctx.clearRect(0, 0, this._width, this._height);
    },
    _setStyles: function(config) {
      this._blur = (config.blur == 0)?0:(config.blur || config.defaultBlur);
      this._radius = (config.radius == 0)?0:(config.radius || config.defaultRadius);

      if (config.backgroundColor) {
        this.canvas.style.backgroundColor = config.backgroundColor;
      }

      this._width = this.canvas.width = this.edgeCanvas.width = this.faceCanvas.width = config.width || this._width;
      this._height = this.canvas.height = this.edgeCanvas.height = this.faceCanvas.height = config.height || this._height;


      this._opacity = (config.opacity || 0) * 255;
      this._maxOpacity = (config.maxOpacity || config.defaultMaxOpacity) * 255;
      this._minOpacity = (config.minOpacity || config.defaultMinOpacity) * 255;
      this._useGradientOpacity = !!config.useGradientOpacity;
      this._absolute = config.absolute == true;
    },
    _drawAlpha: function(data) {
      var min = this._min = data.min;
      var max = this._max = data.max;
      var data = data.data || [];
      var dataLen = data.length;
      // on a point basis?
      var blur = 1 - this._blur;

      while(dataLen--) {

        var point = data[dataLen];

        var x = point.x;
        var y = point.y;
        var radius = point.radius;
        // if value is bigger than max
        // use max as value
        var value = Math.min(point.value, max);
        var rectX = x - radius;
        var rectY = y - radius;
        var faceCtx = this.faceCtx;
        var edgeCtx = this.edgeCtx;




        if (!this._templates[radius]) {
          this._templates[radius] = {
            intensities: [],
            silhouette: _getPointTemplate(radius, blur),
          };
        }
        var tpl = this._templates[radius].silhouette;
        // value from minimum / value range
        // => [0, 1]
        var templateAlpha = Math.max((value-min)/(max-min), .05);
        // this fixes #176: small values are not visible because globalAlpha < .01 cannot be read from imageData
        edgeCtx.globalAlpha = templateAlpha;
        
        if (!this._absolute || !this._useGradientOpacity) {
          edgeCtx.drawImage(tpl, rectX, rectY);
        }

        if (this._absolute) {
          var intensity = Math.round(templateAlpha * 255);

          if (!this._templates[radius].intensities[intensity]) {
            this._templates[radius].intensities[intensity] = tpl = _getIntensityTemplate(radius, blur, intensity);
          } else {
            tpl = this._templates[radius].intensities[intensity];
          }
          faceCtx.globalCompositeOperation = 'lighten';
          faceCtx.drawImage(tpl, rectX, rectY);
        }

        // update renderBoundaries
        if (rectX < this._renderBoundaries[0]) {
            this._renderBoundaries[0] = rectX;
          }
          if (rectY < this._renderBoundaries[1]) {
            this._renderBoundaries[1] = rectY;
          }
          if (rectX + 2*radius > this._renderBoundaries[2]) {
            this._renderBoundaries[2] = rectX + 2*radius;
          }
          if (rectY + 2*radius > this._renderBoundaries[3]) {
            this._renderBoundaries[3] = rectY + 2*radius;
          }

      }
    },
    _colorize: function() {
      var x = this._renderBoundaries[0];
      var y = this._renderBoundaries[1];
      var width = this._renderBoundaries[2] - x;
      var height = this._renderBoundaries[3] - y;
      var maxWidth = this._width;
      var maxHeight = this._height;
      var opacity = this._opacity;
      var maxOpacity = this._maxOpacity;
      var minOpacity = this._minOpacity;
      var useGradientOpacity = this._useGradientOpacity;

      if (x < 0) {
        x = 0;
      }
      if (y < 0) {
        y = 0;
      }
      if (x + width > maxWidth) {
        width = maxWidth - x;
      }
      if (y + height > maxHeight) {
        height = maxHeight - y;
      }

      var img = this.edgeCtx.getImageData(x, y, width, height);
      var imgData = img.data;
      var len = imgData.length;
      var palette = this._palette;
      var blur = this._blur;
      var radius = this._radius;

      var faceData;
      if (this._absolute) {
        var faceImageData;
        if (blur > 0) {
          var blurCanvas = document.createElement('canvas');
          blurCanvas.width = this.faceCanvas.width;
          blurCanvas.height = this.faceCanvas.height;
          var blurCtx = blurCanvas.getContext('2d');
          blurCtx.fillStyle = 'rgba(0,0,0,1)';
          blurCtx.fillRect(0, 0, this.faceCanvas.width, this.faceCanvas.height);
          blurCtx.globalCompositeOperation = 'source-over';
          blurCtx.filter = 'blur(' + radius * (1 - blur) * blur + 'px)';
          blurCtx.drawImage(this.faceCanvas, 0, 0);
          faceImageData = blurCtx.getImageData(x, y, width, height);
        } else {
          faceImageData = this.faceCtx.getImageData(x, y, width, height);
        }
        faceData = faceImageData.data;
      }

      for (var i = 3; i < len; i+= 4) {
        var alpha = imgData[i];
        var offset = (this._absolute ? faceData[i - 3] : alpha) * 4;


        if (!offset) {
          continue;
        }

        var finalAlpha;
        if (opacity > 0) {
          finalAlpha = opacity;
        } else {
          if (alpha < maxOpacity) {
            if (alpha < minOpacity) {
              finalAlpha = minOpacity;
            } else {
              finalAlpha = alpha;
            }
          } else {
            finalAlpha = maxOpacity;
          }
        }

        imgData[i-3] = palette[offset];
        imgData[i-2] = palette[offset + 1];
        imgData[i-1] = palette[offset + 2];
        imgData[i] = useGradientOpacity ? palette[offset + 3] : finalAlpha;

      }

      img.data = imgData;
      this.ctx.putImageData(img, x, y);

      this._renderBoundaries = [1000, 1000, 0, 0];

    },
    getValueAt: function(point) {
      var value, data;
      if (this._absolute) {
        var shadowCtx = this.faceCtx;
        var img = shadowCtx.getImageData(point.x, point.y, 1, 1);
        data = img.data[0];
      } else {
        var shadowCtx = this.edgeCtx;
        var img = shadowCtx.getImageData(point.x, point.y, 1, 1);
        data = img.data[3];
      }
      var max = this._max;
      var min = this._min;

      value = (Math.abs(max-min) * (data/255)) >> 0;

      return value;
    },
    getDataURL: function() {
      return this.canvas.toDataURL();
    }
  };


  return Canvas2dRenderer;
})();
