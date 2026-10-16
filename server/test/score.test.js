import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateLandScore, scoreMetric, METRICS } from '../src/utils/landScore.js';

describe('Land Scoring', () => {
  const sampleLand = {
    id: 'test-1',
    code: 'TEST-001',
    district: 'Fuzuli',
    districtName: 'Fuzuli',
    purpose: 'pambiq',
    purposeLabel: 'Pambiqçiliq',
    color: '#eab308',
    areaHa: 50,
    ph: 6.8,
    fertility: 78,
    waterKm: 1.4,
    sunDays: 265,
    status: 'available',
    cadence: 'İllik'
  };

  it('should calculate overall score and grade', () => {
    const result = calculateLandScore(sampleLand);
    assert.ok(result.score > 0, 'score > 0');
    assert.ok(result.score <= 100, 'score <= 100');
    assert.ok(['A', 'B', 'C', 'D'].includes(result.grade), 'grade is A/B/C/D');
    assert.ok(result.breakdown, 'breakdown exists');
    assert.ok(result.breakdown.fertility > 0, 'fertility > 0');
    assert.ok(result.breakdown.ph > 0, 'ph > 0');
    assert.ok(result.breakdown.water > 0, 'water > 0');
    assert.ok(result.breakdown.sun > 0, 'sun > 0');
    assert.ok(result.breakdown.area > 0, 'area > 0');
  });

  it('should give higher score for optimal pH', () => {
    const optimalLand = { ...sampleLand, ph: 6.5 };
    const suboptimalLand = { ...sampleLand, ph: 5.0 };
    const optimalScore = calculateLandScore(optimalLand);
    const suboptimalScore = calculateLandScore(suboptimalLand);
    assert.ok(optimalScore.score > suboptimalScore.score, 'optimal pH gives higher score');
  });

  it('should give higher score for higher fertility', () => {
    const highFertility = { ...sampleLand, fertility: 90 };
    const lowFertility = { ...sampleLand, fertility: 40 };
    const highScore = calculateLandScore(highFertility);
    const lowScore = calculateLandScore(lowFertility);
    assert.ok(highScore.score > lowScore.score, 'higher fertility gives higher score');
  });

  it('should give higher score for closer water', () => {
    const closeWater = { ...sampleLand, waterKm: 0.5 };
    const farWater = { ...sampleLand, waterKm: 10 };
    const closeScore = calculateLandScore(closeWater);
    const farScore = calculateLandScore(farWater);
    assert.ok(closeScore.score > farScore.score, 'closer water gives higher score');
  });

  it('should handle missing values gracefully', () => {
    const incompleteLand = { ...sampleLand };
    delete incompleteLand.ph;
    delete incompleteLand.waterKm;
    const result = calculateLandScore(incompleteLand);
    assert.ok(result.score >= 0, 'score >= 0');
    assert.ok(result.grade, 'grade is defined');
  });

  describe('scoreMetric', () => {
    it('should return 100 for optimal pH', () => {
      const metric = METRICS.find(m => m.key === 'ph');
      assert.strictEqual(scoreMetric({ ph: 6.5 }, metric), 100);
    });

    it('should return lower score for suboptimal pH', () => {
      const metric = METRICS.find(m => m.key === 'ph');
      assert.ok(scoreMetric({ ph: 5.0 }, metric) < 100);
    });

    it('should return higher score for higher fertility', () => {
      const metric = METRICS.find(m => m.key === 'fertility');
      assert.ok(scoreMetric({ fertility: 90 }, metric) > scoreMetric({ fertility: 50 }, metric));
    });

    it('should return lower score for farther water', () => {
      const metric = METRICS.find(m => m.key === 'waterKm');
      assert.ok(scoreMetric({ waterKm: 1 }, metric) > scoreMetric({ waterKm: 5 }, metric));
    });

    it('should return 0 for missing values', () => {
      const metric = METRICS.find(m => m.key === 'ph');
      assert.strictEqual(scoreMetric({}, metric), 0);
    });
  });
});