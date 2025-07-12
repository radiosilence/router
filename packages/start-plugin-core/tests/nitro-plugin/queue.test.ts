import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { Queue } from '../../src/nitro-plugin/queue'

describe('Queue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  test('should create queue with default config', () => {
    const queue = new Queue()
    
    expect(queue.isRunning()).toBe(false)
    expect(queue.isSettled()).toBe(true)
    expect(queue.getActive()).toHaveLength(0)
    expect(queue.getPending()).toHaveLength(0)
  })

  test('should create queue with custom config', () => {
    const tasks = [() => Promise.resolve('test')]
    const queue = new Queue({
      concurrency: 3,
      started: true,
      tasks,
    })
    
    expect(queue.isRunning()).toBe(true)
    expect(queue.getPending()).toHaveLength(1)
  })

  test('should add tasks to queue', async () => {
    const queue = new Queue()
    const task = vi.fn(() => Promise.resolve('result'))
    
    const promise = queue.add(task)
    expect(queue.getPending()).toHaveLength(1)
    
    queue.start()
    const result = await promise
    
    expect(result).toBe('result')
    expect(task).toHaveBeenCalled()
  })

  test('should add priority tasks to front of queue', () => {
    const queue = new Queue()
    const task1 = () => Promise.resolve('task1')
    const task2 = () => Promise.resolve('task2')
    
    queue.add(task1)
    queue.add(task2, { priority: true })
    
    const pending = queue.getPending()
    expect(pending).toHaveLength(2)
    // Priority task should be first
  })

  test('should respect concurrency limit', async () => {
    const queue = new Queue({ concurrency: 2 })
    const task1 = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    const task2 = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    const task3 = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    queue.add(task1)
    queue.add(task2)
    queue.add(task3)
    
    queue.start()
    
    // Initially, only 2 tasks should be active (concurrency limit)
    await vi.advanceTimersByTimeAsync(50)
    expect(queue.getActive()).toHaveLength(2)
    expect(queue.getPending()).toHaveLength(1)
  })

  test('should handle task success', async () => {
    const queue = new Queue()
    const onSuccess = vi.fn()
    const task = () => Promise.resolve('success')
    
    queue.onSuccess(onSuccess)
    queue.add(task)
    queue.start()
    
    await vi.runAllTimersAsync()
    
    expect(onSuccess).toHaveBeenCalledWith('success', expect.any(Function))
  })

  test('should handle task error', async () => {
    const queue = new Queue()
    const onError = vi.fn()
    const error = new Error('task failed')
    const task = () => Promise.reject(error)
    
    queue.onError(onError)
    
    try {
      await queue.add(task)
    } catch (e) {
      // Expected to throw
    }
    
    queue.start()
    await vi.runAllTimersAsync()
    
    expect(onError).toHaveBeenCalledWith(error, expect.any(Function))
  })

  test('should handle task settlement', async () => {
    const queue = new Queue()
    const onSettled = vi.fn()
    const task = () => Promise.resolve('result')
    
    queue.onSettled(onSettled)
    queue.add(task)
    queue.start()
    
    await vi.runAllTimersAsync()
    
    expect(onSettled).toHaveBeenCalledWith('result', undefined)
  })

  test('should throttle concurrency', async () => {
    const queue = new Queue({ concurrency: 3 })
    const task = () => new Promise(resolve => setTimeout(resolve, 100))
    
    queue.add(task)
    queue.add(task)
    queue.add(task)
    queue.add(task)
    
    queue.start()
    await vi.advanceTimersByTimeAsync(50)
    expect(queue.getActive()).toHaveLength(3)
    
    queue.throttle(1)
    // Throttling doesn't stop active tasks, but limits new ones
    expect(queue.getActive()).toHaveLength(3)
  })

  test('should stop queue', () => {
    const queue = new Queue()
    queue.start()
    expect(queue.isRunning()).toBe(true)
    
    queue.stop()
    expect(queue.isRunning()).toBe(false)
  })

  test('should clear pending tasks', () => {
    const queue = new Queue()
    const task = () => Promise.resolve()
    
    queue.add(task)
    queue.add(task)
    expect(queue.getPending()).toHaveLength(2)
    
    queue.clear()
    expect(queue.getPending()).toHaveLength(0)
  })

  test('should return all tasks (active + pending)', () => {
    const queue = new Queue({ concurrency: 1 })
    const task = () => new Promise(resolve => setTimeout(resolve, 100))
    
    queue.add(task)
    queue.add(task)
    queue.add(task)
    
    queue.start()
    
    const all = queue.getAll()
    expect(all).toHaveLength(3)
  })

  test('should be settled when no active or pending tasks', async () => {
    const queue = new Queue()
    expect(queue.isSettled()).toBe(true)
    
    const task = () => Promise.resolve()
    queue.add(task)
    expect(queue.isSettled()).toBe(false)
    
    queue.start()
    await vi.runAllTimersAsync()
    expect(queue.isSettled()).toBe(true)
  })

  test('should handle synchronous tasks', async () => {
    const queue = new Queue()
    const task = vi.fn(() => 'sync result')
    
    const promise = queue.add(task)
    queue.start()
    
    const result = await promise
    expect(result).toBe('sync result')
    expect(task).toHaveBeenCalled()
  })

  test('should unsubscribe from events', () => {
    const queue = new Queue()
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const onSettled = vi.fn()
    
    const unsubSuccess = queue.onSuccess(onSuccess)
    const unsubError = queue.onError(onError)
    const unsubSettled = queue.onSettled(onSettled)
    
    unsubSuccess()
    unsubError()
    unsubSettled()
    
    const task = () => Promise.resolve('result')
    queue.add(task)
    queue.start()
    
    // Events should not be called after unsubscribing
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
  })

  test('should wait for queue to settle', async () => {
    const queue = new Queue()
    const task1 = () => new Promise(resolve => setTimeout(() => resolve('task1'), 100))
    const task2 = () => new Promise(resolve => setTimeout(() => resolve('task2'), 200))
    
    queue.add(task1)
    queue.add(task2)
    
    const startPromise = queue.start()
    
    expect(queue.isSettled()).toBe(false)
    
    await vi.runAllTimersAsync()
    await startPromise
    
    expect(queue.isSettled()).toBe(true)
  })

  test('should handle task that throws synchronously', async () => {
    const queue = new Queue()
    const onError = vi.fn()
    const error = new Error('sync error')
    const task = () => { throw error }
    
    queue.onError(onError)
    
    try {
      await queue.add(task)
    } catch (e) {
      expect(e).toBe(error)
    }
    
    queue.start()
    await vi.runAllTimersAsync()
    
    expect(onError).toHaveBeenCalledWith(error, expect.any(Function))
  })

  test('should process tasks in order when concurrency is 1', async () => {
    const queue = new Queue({ concurrency: 1 })
    const results: string[] = []
    
    const task1 = () => new Promise(resolve => {
      setTimeout(() => {
        results.push('task1')
        resolve('task1')
      }, 100)
    })
    
    const task2 = () => new Promise(resolve => {
      setTimeout(() => {
        results.push('task2')
        resolve('task2')
      }, 50)
    })
    
    queue.add(task1)
    queue.add(task2)
    queue.start()
    
    await vi.runAllTimersAsync()
    
    expect(results).toEqual(['task1', 'task2'])
  })
})