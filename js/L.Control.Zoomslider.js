/*
Copyright (c) 2012, Kartena AB
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met: 

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer. 
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution. 

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

L.Control.Zoomslider = (function(){

	var Knob = L.Draggable.extend({
		initialize: function (element, steps, stepHeight, knobHeight) {
			var sliderHeight = steps * stepHeight;
			L.Draggable.prototype.initialize.call(this, element, element);

			this._element = element;
			this._maxValue = steps - 1;

			// conversion parameters
			// the conversion is just a common linear function.
			this._k = -stepHeight;
			this._m = sliderHeight - (stepHeight + knobHeight) / 2;

			this.on('predrag', function() {
				this._newPos.x = 0;
				this._newPos.y = this._adjust(this._newPos.y);
			}, this);
		},

		_adjust: function (y) {
			var value = Math.round(this._toValue(y));
			value = Math.max(0, Math.min(this._maxValue, value));
			return this._toY(value);
		},

		// y = k*v + m
		_toY: function (value) {
			return this._k * value + this._m;
		},
		// v = (y - m) / k
		_toValue: function (y) {
			return (y - this._m) / this._k;
		},

		setPosition: function (y) {
			L.DomUtil.setPosition(this._element,
								  L.point(0, this._adjust(y)));
		},

		setValue: function (v) {
			this.setPosition(this._toY(v));
		},

		getValue: function () {
			return this._toValue(L.DomUtil.getPosition(this._element).y);
		}
	});

	var Zoomslider = L.Control.extend({
		options: {
			position: 'topleft',
			// Height of zoom-slider.png in px
			stepHeight: 9,
			// Height of the knob div in px
			knobHeight: 5,
			styleNS: 'leaflet-control-zoomslider'
		},

		onAdd: function (map) {
			var container = L.DomUtil.create('div', this.options.styleNS + ' leaflet-bar');

			L.DomEvent.disableClickPropagation(container);

			this._map = map;

			this._zoomInButton = this._createZoomButton(
				'in', 'top', container, this._zoomIn);

			this._sliderElem = L.DomUtil.create(
				'div',
				this.options.styleNS + "-slider leaflet-bar-part",
				container);

			this._zoomOutButton = this._createZoomButton(
				'out', 'bottom', container, this._zoomOut);

			map .on('layeradd layerremove', this._refresh, this)
				.on("zoomend", this._updateSlider, this)
				.on("zoomend", this._updateDisabled, this)
				.whenReady(this._createSlider, this)
				.whenReady(this._createKnob, this)
				.whenReady(this._updateSlider, this)
				.whenReady(this._updateDisabled, this);

			return container;
		},

		onRemove: function (map) {
			map .off("zoomend", this._updateSlider)
				.off("zoomend", this._updateDisabled)
				.off('layeradd layerremove', this._refresh);
		},

		_refresh: function () {
			// TODO: listen to zoomlevelschange-event instead in 0.6.x
			this._map
				.removeControl(this)
				.addControl(this);
		},
		_zoomLevels: function(){
			return this._map.getMaxZoom() - this._map.getMinZoom() + 1;
		},

		_createSlider: function () {
			var zoomLevels = this._zoomLevels();

			// No tilelayer probably
			if(zoomLevels == Infinity){
				return;
			}

			this._sliderBody = L.DomUtil.create('div',
												this.options.styleNS + '-slider-body',
												this._sliderElem);
			this._sliderBody.style.height
				= (this.options.stepHeight * zoomLevels) + "px";
			L.DomEvent.on(this._sliderBody, 'click', this._onSliderClick, this);
		},

		_createKnob: function () {
			var knobElem,
				zoomLevels = this._zoomLevels();

			// No tilelayer probably
			if(zoomLevels == Infinity) {
				return;
			}

			knobElem = L.DomUtil.create('div', this.options.styleNS + '-slider-knob',
										this._sliderBody);
			L.DomEvent.disableClickPropagation(knobElem);

			this._knob = new Knob(knobElem,
								  this._zoomLevels(),
								  this.options.stepHeight,
								  this.options.knobHeight)
				.on('dragend', this._updateZoom, this);
			this._knob.enable();
		},

		_onSliderClick: function (e) {
			var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e);
			var y = L.DomEvent.getMousePosition(first).y
	  				- L.DomUtil.getViewportOffset(this._sliderBody).y; // Cache this?
			this._knob.setPosition(y);
			this._updateZoom();
		},

		_zoomIn: function (e) {
			this._map.zoomIn(e.shiftKey ? 3 : 1);
		},
		_zoomOut: function (e) {
			this._map.zoomOut(e.shiftKey ? 3 : 1);
		},

		_createZoomButton: function (zoomDir, end, container, fn) {
			var barPart = 'leaflet-bar-part',
				classDef = this.options.styleNS + '-' + zoomDir
					+ ' ' + barPart
					+ ' ' + barPart + '-' + end,
				title = 'Zoom ' + zoomDir,
				link = L.DomUtil.create('a', classDef, container);
			link.href = '#';
			link.title = title;

			L.DomEvent
				.on(link, 'click', L.DomEvent.preventDefault)
				.on(link, 'click', fn, this);

			return link;
		},
		_toZoomLevel: function (sliderValue) {
			return sliderValue + this._map.getMinZoom();
		},
		_toSliderValue: function (zoomLevel) {
			return zoomLevel - this._map.getMinZoom();
		},

		_updateZoom: function(){
			this._map.setZoom(this._toZoomLevel(this._knob.getValue()));
		},
		_updateSlider: function(){
			if(this._knob){
				this._knob.setValue(this._toSliderValue(this._map.getZoom()));
			}
		},
		_updateDisabled: function () {
			var map = this._map,
				className = this.options.styleNS + '-disabled';

			L.DomUtil.removeClass(this._zoomInButton, className);
			L.DomUtil.removeClass(this._zoomOutButton, className);

			if (map.getZoom() === map.getMinZoom()) {
				L.DomUtil.addClass(this._zoomOutButton, className);
			}
			if (map.getZoom() === map.getMaxZoom()) {
				L.DomUtil.addClass(this._zoomInButton, className);
			}
		}
	});
	return Zoomslider;
})();

L.Map.mergeOptions({
    zoomControl: false,
    zoomsliderControl: true
});

L.Map.addInitHook(function () {
    if (this.options.zoomsliderControl) {
		this.zoomsliderControl = new L.Control.Zoomslider();
		this.addControl(this.zoomsliderControl);
	}
});

L.control.zoomslider = function (options) {
    return new L.Control.Zoomslider(options);
};