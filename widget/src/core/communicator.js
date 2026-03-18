/**
 * EchoWall Widget Communicator
 * 安全的跨窗口通信模块
 */

(function(global, factory) {
  'use strict';
  
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global.EchoWallComm = factory();
  }
})(this, function() {
  'use strict';

  // ============ 消息队列 ============
  
  function MessageQueue(maxSize) {
    this.queue = [];
    this.maxSize = maxSize || 100;
    this.processing = false;
  }

  MessageQueue.prototype.push = function(message) {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }
    this.queue.push(message);
    this.process();
  };

  MessageQueue.prototype.process = function() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    var message = this.queue.shift();
    
    try {
      this.onProcess(message);
    } catch (error) {
      console.error('[EchoWallComm] Message processing error:', error);
    }
    
    this.processing = false;
    
    if (this.queue.length > 0) {
      setTimeout(this.process.bind(this), 0);
    }
  };

  MessageQueue.prototype.onProcess = function() {};

  MessageQueue.prototype.clear = function() {
    this.queue = [];
  };

  // ============ 通信器类 ============
  
  function Communicator(options) {
    this.options = options || {};
    this.allowedOrigins = this.options.allowedOrigins || [];
    this.targetWindow = this.options.targetWindow;
    this.targetOrigin = this.options.targetOrigin || '*';
    this.listeners = new Map();
    this.messageQueue = new MessageQueue(this.options.queueSize);
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.connected = false;
    this.heartbeatInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = this.options.maxReconnectAttempts || 5;
    
    this._onMessage = this.onMessage.bind(this);
    window.addEventListener('message', this._onMessage);
    
    if (this.options.autoConnect !== false) {
      this.connect();
    }
  }

  // ============ 连接管理 ============
  
  Communicator.prototype.connect = function() {
    this.connected = true;
    this.reconnectAttempts = 0;
    
    if (this.options.heartbeat) {
      this.startHeartbeat();
    }
    
    this.emit('connect');
  };

  Communicator.prototype.disconnect = function() {
    this.connected = false;
    this.stopHeartbeat();
    window.removeEventListener('message', this._onMessage);
    
    this.pendingRequests.forEach(function(request) {
      clearTimeout(request.timeout);
      request.reject(new Error('Disconnected'));
    });
    this.pendingRequests.clear();
    
    this.emit('disconnect');
  };

  Communicator.prototype.reconnect = function() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }
    
    this.reconnectAttempts++;
    this.emit('reconnect', { attempt: this.reconnectAttempts });
    
    var self = this;
    setTimeout(function() {
      self.connect();
    }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
  };

  // ============ 心跳检测 ============
  
  Communicator.prototype.startHeartbeat = function() {
    var self = this;
    var interval = this.options.heartbeatInterval || 30000;
    
    this.heartbeatInterval = setInterval(function() {
      if (!self.connected) return;
      
      self.send('__heartbeat', { time: Date.now() })
        .then(function() {
          self.emit('heartbeat', { status: 'ok' });
        })
        .catch(function() {
          self.emit('heartbeat', { status: 'failed' });
          self.reconnect();
        });
    }, interval);
  };

  Communicator.prototype.stopHeartbeat = function() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  };

  // ============ 消息处理 ============
  
  Communicator.prototype.onMessage = function(event) {
    // 安全检查
    if (!this.isValidOrigin(event.origin)) {
      return;
    }
    
    if (this.targetWindow && event.source !== this.targetWindow) {
      return;
    }
    
    var data = event.data;
    
    if (!data || typeof data !== 'object') {
      return;
    }
    
    // 处理响应
    if (data.__requestId && this.pendingRequests.has(data.__requestId)) {
      this.handleResponse(data);
      return;
    }
    
    // 处理心跳
    if (data.type === '__heartbeat') {
      this.send('__heartbeat_ack', { time: data.data.time });
      return;
    }
    
    // 分发消息
    this.dispatch(data.type, data.data, event);
  };

  Communicator.prototype.isValidOrigin = function(origin) {
    if (this.allowedOrigins.length === 0) {
      return true;
    }
    
    return this.allowedOrigins.indexOf(origin) !== -1;
  };

  Communicator.prototype.dispatch = function(type, data, event) {
    var handlers = this.listeners.get(type);
    
    if (handlers) {
      handlers.forEach(function(handler) {
        try {
          handler(data, event);
        } catch (error) {
          console.error('[EchoWallComm] Handler error:', error);
        }
      });
    }
    
    // 通配符监听器
    var allHandlers = this.listeners.get('*');
    if (allHandlers) {
      allHandlers.forEach(function(handler) {
        try {
          handler({ type: type, data: data }, event);
        } catch (error) {
          console.error('[EchoWallComm] Handler error:', error);
        }
      });
    }
  };

  Communicator.prototype.handleResponse = function(data) {
    var request = this.pendingRequests.get(data.__requestId);
    
    if (!request) return;
    
    clearTimeout(request.timeout);
    this.pendingRequests.delete(data.__requestId);
    
    if (data.error) {
      request.reject(new Error(data.error));
    } else {
      request.resolve(data.data);
    }
  };

  // ============ 消息发送 ============
  
  Communicator.prototype.send = function(type, data) {
    var self = this;
    
    return new Promise(function(resolve, reject) {
      if (!self.connected) {
        reject(new Error('Not connected'));
        return;
      }
      
      if (!self.targetWindow) {
        reject(new Error('No target window'));
        return;
      }
      
      var message = {
        type: type,
        data: data,
        timestamp: Date.now()
      };
      
      try {
        self.targetWindow.postMessage(message, self.targetOrigin);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  };

  Communicator.prototype.request = function(type, data, timeout) {
    var self = this;
    
    return new Promise(function(resolve, reject) {
      if (!self.connected) {
        reject(new Error('Not connected'));
        return;
      }
      
      self.requestId++;
      var id = self.requestId;
      
      var message = {
        type: type,
        data: data,
        __requestId: id,
        timestamp: Date.now()
      };
      
      var timeoutId = setTimeout(function() {
        self.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeout || 10000);
      
      self.pendingRequests.set(id, {
        resolve: resolve,
        reject: reject,
        timeout: timeoutId
      });
      
      try {
        self.targetWindow.postMessage(message, self.targetOrigin);
      } catch (error) {
        clearTimeout(timeoutId);
        self.pendingRequests.delete(id);
        reject(error);
      }
    });
  };

  // ============ 事件监听 ============
  
  Communicator.prototype.on = function(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
    
    var self = this;
    return function() {
      self.off(type, handler);
    };
  };

  Communicator.prototype.off = function(type, handler) {
    var handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  };

  Communicator.prototype.once = function(type, handler) {
    var self = this;
    var onceHandler = function(data, event) {
      self.off(type, onceHandler);
      handler(data, event);
    };
    this.on(type, onceHandler);
  };

  Communicator.prototype.emit = function(type, data) {
    this.dispatch(type, data, null);
  };

  // ============ 工具方法 ============
  
  Communicator.prototype.setTargetWindow = function(win) {
    this.targetWindow = win;
  };

  Communicator.prototype.setAllowedOrigins = function(origins) {
    this.allowedOrigins = origins || [];
  };

  Communicator.prototype.isConnected = function() {
    return this.connected;
  };

  Communicator.prototype.getPendingCount = function() {
    return this.pendingRequests.size;
  };

  return {
    create: function(options) {
      return new Communicator(options);
    },
    Communicator: Communicator,
    MessageQueue: MessageQueue
  };
});
