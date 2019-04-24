/*eslint no-underscore-dangle: "off"*/
const expect = require('chai').expect;
const sinon = require('sinon');
const rewire = require('rewire');
var config = require('../../src/util.js').getConfig()[1];

const exporter = rewire('../../src/modules/metrics/exporter.js');
const metrics = rewire('../../src/modules/metrics/metrics.js');
const scheduler = require('../../src/modules/metrics/scheduler.js');

module.exports = function() {
  describe('Test exporter', function() {
    let portClosed = true;
    before(function() {
      exporter.__set__('checkIfPortClosed', function() {
        return portClosed;
      });
      //Mock the webpage because it's not tested
      exporter.__set__('http', {
        createServer: function() {
          return this;
        },
        listen: function() {
          return;
        }
      });
      exporter.__set__('emitter', {
        emit: function() {
          return;
        }
      });
    });
    it('Should return fake prom when metrics disabled', async function() {
      config.metrics.activated = false;
      let response = await exporter.init();
      //Check if the response doesn't contain a property only the real prom has
      expect(response.register).to.be.undefined;
    });
    it('Should return real prom when metrics enabled', async function() {
      config.metrics.activated = true;
      let response = await exporter.init();
      //Check if the response does contain a property only the real prom has
      expect(response.register).to.not.be.undefined;
    });
    it('Should return fake prom when port used', async function() {
      portClosed = false;
      let response = await exporter.init();
      //Check if the response doesn't contain a property only the real prom has
      expect(response.register).to.be.undefined;
    });
  });
  describe('Test metrics', function() {
    before(function() {
      //Set exporter with mocks
      metrics.__set__('exporter', exporter);
    })
    it('Should have metrics when metrics enabled', async function() {
      config.metrics.activated = true;
      await metrics.init();
      expect(metrics.startupTimeSeconds).to.not.be.undefined;
    });
    it('Should have metrics when metrics disabled', async function() {
      config.metrics.activated = false;
      await metrics.init();
      expect(metrics.startupTimeSeconds).to.not.be.undefined;
    });
  });
  describe('Test scheduler', function() {
    let testMetric;
    before(function() {
      //Set time
      sinon.useFakeTimers(0);
      //Must import the real module without rewire to stub real metric
      let realMetrics = require('../../src/modules/metrics/metrics.js');
      testMetric = sinon.spy(realMetrics.uniqueGuildTotal, 'set');
    });
    beforeEach(function() {
      //Reset before each test
      testMetric.resetHistory();
    });
    it('Should update metrics when event emitted', async function() {
      //Get real emitter without rewire
      let { emitter } = require('../../src/modules/metrics/exporter.js');
      emitter.emit('startMetrics');
      //Wait for end event
      await new Promise(resolve => {
        scheduler.emitter.on('endCollection', () => {
          expect(testMetric.called).to.equal(true);
          resolve();
        });
      });
    });
    it('Should update metrics 10m after', async function() {
      //Set timer to 10m forward
      sinon.useFakeTimers(600150);
      //Start job
      scheduler.collection.job();
      //Wait for end event
      await new Promise(resolve => {
        scheduler.emitter.on('endCollection', () => {
          expect(testMetric.called).to.equal(true);
          resolve();
        });
      });
    });
  });
}
