import { describe, expect, it, vi } from 'vitest';
import { AnimationClock, type AnimationSet } from '../src/game/AnimationClock';

const SET: AnimationSet = {
  idle: { row: 0, frames: 4, fps: 4, loop: true },
  walk: { row: 1, frames: 6, fps: 12, loop: true },
  die: { row: 2, frames: 3, fps: 3, loop: false },
};

describe('AnimationClock', () => {
  it('advances frames at the configured fps and loops', () => {
    const clock = new AnimationClock(SET, 'idle');
    expect(clock.frame).toBe(0);
    clock.update(0.26); // 1 frame at 4 fps
    expect(clock.frame).toBe(1);
    clock.update(0.75); // total 1.01s -> 4 frames elapsed -> wraps to 0
    expect(clock.frame).toBe(0);
  });

  it('reports whether the visible frame changed', () => {
    const clock = new AnimationClock(SET, 'idle');
    expect(clock.update(0.1)).toBe(false);
    expect(clock.update(0.2)).toBe(true);
  });

  it('plays a non-looping animation once, holds the last frame and fires onComplete exactly once', () => {
    const done = vi.fn();
    const clock = new AnimationClock(SET, 'idle', done);
    clock.play('die');
    clock.update(0.5);
    expect(done).not.toHaveBeenCalled();
    clock.update(0.6); // 1.1s > 3 frames / 3 fps
    expect(clock.frame).toBe(2);
    expect(clock.isFinished).toBe(true);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith('die');
    clock.update(5);
    expect(done).toHaveBeenCalledTimes(1);
    expect(clock.frame).toBe(2);
  });

  it('does not restart when asked to play the animation already playing', () => {
    const clock = new AnimationClock(SET, 'walk');
    clock.update(0.2);
    const frame = clock.frame;
    expect(frame).toBeGreaterThan(0);
    clock.play('walk');
    expect(clock.frame).toBe(frame);
    clock.play('walk', true);
    expect(clock.frame).toBe(0);
  });

  it('switching animation resets frame and exposes the new row', () => {
    const clock = new AnimationClock(SET, 'idle');
    clock.update(0.5);
    clock.play('walk');
    expect(clock.name).toBe('walk');
    expect(clock.frame).toBe(0);
    expect(clock.row).toBe(1);
  });

  it('throws on unknown animation names', () => {
    expect(() => new AnimationClock(SET, 'nope')).toThrow(/Unknown animation/);
    const clock = new AnimationClock(SET, 'idle');
    expect(() => clock.play('nope')).toThrow(/Unknown animation/);
  });
});
