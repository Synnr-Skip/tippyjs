import Popper from 'popper.js'

/**!
* @file tippy.js | Pure JS Tooltip Library
* @version 0.12.0
* @license MIT
*/

// Touch user is assumed false until a `touchstart` event is fired
// id counter for our aria-describedby labelling (tooltip IDs)
const GLOBALS = {
    touchUser: false,
    idCounter: 0
}

// Storage object to hold all references from instance instantiation
// Allows us to hide tooltips from other instances when clicking on the body
const STORE = {
    refs: []
}

const DEFAULTS = {
    html: false,
    position: 'top',
    animation: 'shift',
    animateFill: true,
    arrow: false,
    arrowSize: 'regular',
    delay: 0,
    hideDelay: 0,
    trigger: 'mouseenter focus',
    duration: 375,
    hideDuration: 375,
    interactive: false,
    theme: 'dark',
    size: 'regular',
    distance: 10,
    offset: 0,
    hideOnClick: true,
    multiple: false,
    followCursor: false,
    inertia: false,
    transitionFlip: true,
    popperOptions: {}
}

const DEFAULTS_KEYS = Object.keys(DEFAULTS)

const SELECTORS = {
    popper: '.tippy-popper',
    tooltip: '.tippy-tooltip',
    content: '.tippy-tooltip-content',
    circle: '[x-circle]',
    arrow: '[x-arrow]',
    el: '[data-tooltipped]',
    controller: '[data-tippy-controller]'
}

// Determine touch users
function handleDocumentTouchstart() {
    GLOBALS.touchUser = true

    // iOS needs a `cursor: pointer` on the body to register clicks
    if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent) && !window.MSStream) {
        document.body.classList.add('tippy-touch')
    }

    document.removeEventListener('touchstart', handleDocumentTouchstart)
}

// Handle clicks anywhere on the document
function handleDocumentClick(event) {

    const el = closest(event.target, SELECTORS.el)
    const popper = closest(event.target, SELECTORS.popper)

    if (popper) {
        const ref = find(STORE.refs, ref => ref.popper === popper)
        if (ref.settings.interactive) return
    }

    if (el) {
        const ref = find(STORE.refs, ref => ref.el === el)

        // If they clicked before the show() was to fire, clear it
        if (ref.settings.hideOnClick === true && !GLOBALS.touchUser) {
            clearTimeout(ref.popper.getAttribute('data-delay'))
        }

        // Hide all poppers except the one belonging to the element that was clicked IF
        // `multiple` is false AND they are a touch user, OR
        // `multiple` is false AND it's triggered by a click
        if (
            (!ref.settings.multiple && GLOBALS.touchUser) ||
            (!ref.settings.multiple && ref.settings.trigger.indexOf('click') !== -1)
        )
        {
            return hideAllPoppers(ref)
        }

        // If hideOnClick is not strictly true or triggered by a click don't hide poppers
        if (ref.settings.hideOnClick !== true ||
            ref.settings.trigger.indexOf('click') !== -1
        ) return
    }

    // Don't trigger a hide for tippy controllers, and don't needlessly run loop
    if (closest(event.target, SELECTORS.controller) ||
        !document.body.querySelector(SELECTORS.popper)
    ) return

    hideAllPoppers()
}

// Prevent errors in <= IE8
if (document.addEventListener) {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('touchstart', handleDocumentTouchstart)
}

/**
* Returns the supported prefixed property - only `webkit` is needed, `moz`, `ms` and `o` are obsolete
* @param {String} property
* @return {String} - browser supported prefixed property
*/
function prefix(property) {
    const prefixes = [false, 'webkit']
    const upperProp = property.charAt(0).toUpperCase() + property.slice(1)

    for (var i = 0; i < prefixes.length; i++) {
        const prefix = prefixes[i]
        const prefixedProp = prefix ? '' + prefix + upperProp : property
        if (typeof window.document.body.style[prefixedProp] !== 'undefined') {
            return prefixedProp
        }
    }

    return null
}

/**
* Returns the non-shifted placement (e.g., 'bottom-start' => 'bottom')
* @param {String} placement
* @return {String}
*/
function getCorePlacement(placement) {
    return placement.replace(/-.+/, '')
}

/**
* Polyfill to get the closest parent element
* @param {Element} element - child of parent to be returned
* @param {String} parentSelector - selector to match the parent if found
* @return {Element}
*/
function closest(element, parentSelector) {
    if (!Element.prototype.matches) {
        Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        function(s) {
            var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                i = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {}
                return i > -1;
        }
    }
    if (!Element.prototype.closest) Element.prototype.closest = function(selector) {
        var el = this
        while (el) {
            if (el.matches(selector)) {
                return el
            }
            el = el.parentElement
        }
    }
    return element.closest(parentSelector)
}

/**
* Polyfill for Array.prototype.find
* @param {Array} arr
* @param {Function} checkFn
* @return item in the array
*/
function find(arr, checkFn) {
  if (Array.prototype.find) {
    return arr.find(checkFn)
  }

  // use `filter` as fallback
  return arr.filter(checkFn)[0]
}

/**
* Creates a new popper instance
* @param {Object} ref
* @return {Object} - the popper instance
*/
function createPopperInstance(ref) {

    const settings = ref.settings
    const tooltip = ref.popper.querySelector(SELECTORS.tooltip)

    const config = {
        placement: settings.position,
        ...(settings.popperOptions || {}),
        modifiers: {
            ...(settings.popperOptions ? settings.popperOptions.modifiers : {}),
            flip: {
                padding: parseInt(settings.distance) + 5 /* 5px from viewport boundary */,
                ...(settings.popperOptions && settings.popperOptions.modifiers ? settings.popperOptions.modifiers.flip : {})
            },
            offset: {
                offset: parseInt(settings.offset),
                ...(settings.popperOptions && settings.popperOptions.modifiers ? settings.popperOptions.modifiers.offset : {})
            }
        },
        onUpdate() {
            tooltip.style.top = ''
            tooltip.style.bottom = ''
            tooltip.style.left = ''
            tooltip.style.right = ''
            tooltip.style[getCorePlacement(ref.popper.getAttribute('x-placement'))] = -(settings.distance - 10) + 'px'
        }
    }

    return new Popper(ref.el, ref.popper, config)
}

/**
* Creates a popper element then returns it
* @param {Number} id - the popper id
* @param {String} title - the tooltip's `title` attribute
* @param {Object} settings - individual settings
* @return {Element} - the popper element
*/
function createPopperElement(id, title, settings) {
    const popper = document.createElement('div')
    popper.setAttribute('class', 'tippy-popper')
    popper.setAttribute('role', 'tooltip')
    popper.setAttribute('aria-hidden', 'true')
    popper.setAttribute('id', `tippy-tooltip-${id}`)

    const tooltip = document.createElement('div')
    tooltip.setAttribute('class', `tippy-tooltip tippy-tooltip--${settings.size} ${settings.theme}-theme leave`)
    tooltip.setAttribute('data-animation', settings.animation)

    if (settings.arrow) {
        // Add an arrow
        const arrow = document.createElement('div')
        arrow.setAttribute('class', `arrow-${settings.arrowSize}`)
        arrow.setAttribute('x-arrow', '')
        tooltip.appendChild(arrow)
    }

    if (settings.animateFill) {
        // Create animateFill circle element for animation
        tooltip.setAttribute('data-animatefill', '')
        const circle = document.createElement('div')
        circle.setAttribute('class', 'leave')
        circle.setAttribute('x-circle', '')
        tooltip.appendChild(circle)
    }

    if (settings.inertia) {
        // Change transition timing function cubic bezier
        tooltip.setAttribute('data-inertia', '')
    }

    // Tooltip content (text or HTML)
    const content = document.createElement('div')
    content.setAttribute('class', 'tippy-tooltip-content')

    if (settings.html) {

        let templateId

        if (settings.html instanceof Element) {
            content.innerHTML = settings.html.innerHTML
            templateId = settings.html.id || 'tippy-html-template'
        } else {
            content.innerHTML = document.getElementById(settings.html.replace('#', '')).innerHTML
            templateId = settings.html
        }

        popper.classList.add('html-template')
        popper.setAttribute('tabindex', '0')
        tooltip.setAttribute('data-template-id', templateId)

    } else {
        content.innerHTML = title
    }

    // Init distance. Further updates are made in the popper instance's `onUpdate()` method
    tooltip.style[getCorePlacement(settings.position)] = -(settings.distance - 10) + 'px'

    tooltip.appendChild(content)
    popper.appendChild(tooltip)

    return popper
}

/**
* Creates a trigger
* @param {Object} event - the custom event specified in the `trigger` setting
* @param {Element} el - tooltipped element
* @param {Object} handlers - the handlers for each listener
* @return {Array} - array of listener objects
*/
function createTrigger(event, el, handlers) {
    const listeners = []

    if (event === 'manual') return listeners

    // Enter
    el.addEventListener(event, handlers.handleTrigger)
    listeners.push({
        event,
        handler: handlers.handleTrigger
    })

    // Leave
    if (event === 'mouseenter') {
        el.addEventListener('mouseleave', handlers.handleMouseleave)
        listeners.push({
            event: 'mouseleave',
            handler: handlers.handleMouseleave
        })
    }
    if (event === 'focus') {
        el.addEventListener('blur', handlers.handleBlur)
        listeners.push({
            event: 'blur',
            handler: handlers.handleBlur
        })
    }

    return listeners
}

/**
* Adds each reference (tooltipped element, popper and its settings/listeners etc)
* into global storage
* @param {Object} ref - current ref in the forEach loop to be pushed
*/
function pushIntoStorage(ref) {
    STORE.refs.push(ref)
}

/**
* Removes the title from the tooltipped element
* @param {Element} el
*/
function removeTitle(el) {
    const title = el.getAttribute('title')
    el.setAttribute('data-original-title', title || 'html')
    el.removeAttribute('title')
}

/**
* Determines if an element is visible in the viewport
* @param {Element} el
* @return {Boolean}
*/
function elementIsInViewport(el) {
    const rect = el.getBoundingClientRect()

    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
}

/**
* Mousemove event listener callback method for follow cursor setting
* @param {Object} e (event)
*/
function followCursor(e) {
    const ref = find(STORE.refs, ref => ref.el === this)
    const position = getCorePlacement(ref.popper.getAttribute('x-placement'))
    const halfPopperWidth = Math.round( ref.popper.offsetWidth / 2 )
    const halfPopperHeight = Math.round( ref.popper.offsetHeight / 2 )

    // Default = top
    let x = e.pageX - halfPopperWidth
    let y = e.pageY - 2.5 * halfPopperHeight

    if (position === 'left') {
        x = e.pageX - ( 2 * halfPopperWidth ) - 15
        y = e.pageY - halfPopperHeight
    } else if (position === 'right') {
        x = e.pageX + halfPopperHeight
        y = e.pageY - halfPopperHeight
    } else if (position === 'bottom') {
        y = e.pageY + halfPopperHeight/1.5
    }

    ref.popper.style[prefix('transform')] = `translate3d(${x}px, ${y}px, 0)`
}

/**
* Triggers a document repaint or reflow for CSS transition
* @param {Element} tooltip
* @param {Element} circle
*/
function triggerReflow(tooltip, circle) {
    // Safari needs the specific 'transform' property to be accessed
    circle ? window.getComputedStyle(circle)[prefix('transform')]
           : window.getComputedStyle(tooltip).opacity
}

/**
* Modifies elements' class lists
* @param {Array} els - HTML elements
* @param {Function} callback
*/
function modifyClassList(els, callback) {
    els.forEach(el => {
        if (!el) return
        callback(el.classList)
    })
}

/**
* Applies the transition duration to each element
* @param {Array} els - HTML elements
* @param {Number} duration
*/
function applyTransitionDuration(els, duration) {
    els.forEach(el => {
        if (!el) return
        if (el.hasAttribute('x-circle')) duration /= 1.25
        el.style[prefix('transitionDuration')] = duration + 'ms'
    })
}

/**
* Fixes CSS transition
* @param {Object} ref - element/popper reference
* @param {Function} callback - the quick hide/show correction
*/
function correctTransition(ref, callback) {
    // Queue once popper has altered x-placement
    setTimeout(() => {
        const isFlipped = ref.settings.position !== ref.popper.getAttribute('x-placement')
        if (!ref.flipped && isFlipped) {
            ref.flipped = true
            callback()
        } else if (ref.flipped && !isFlipped) {
            ref.flipped = false
            callback()
        }
    }, 0)
}

/**
* Prepares the callback functions for `show` and `hide` methods
* @param {Object} ref -  the element/popper reference
* @param {Number} duration
* @param {Function} callback - callback function to fire once transitions complete
*/
function onTransitionEnd(ref, duration, callback) {

    const tooltip = ref.popper.querySelector(SELECTORS.tooltip)
    let transitionendFired = false

    const listenerCallback = (e) => {
        if (e.target !== tooltip) return

        transitionendFired = true

        tooltip.removeEventListener('webkitTransitionEnd', listenerCallback)
        tooltip.removeEventListener('transitionend', listenerCallback)

        callback()
    }

    // Wait for transitions to complete
    tooltip.addEventListener('webkitTransitionEnd', listenerCallback)
    tooltip.addEventListener('transitionend', listenerCallback)

    // transitionend listener sometimes may not fire
    clearTimeout(ref.transitionendTimeout)
    ref.transitionendTimeout = setTimeout(() => {
        if (!transitionendFired) {
            callback()
        }
    }, duration)
}

/**
* @param {Element} popper
* @return {Boolean}
*/
function isExpectedState(popper, type) {
    const visibility = popper.style.visibility
    return type === 'show' ? visibility === 'visible' : visibility === 'hidden'
}

/**
* Appends the popper and creates a popper instance if one does not exist
* Also updates its position if need be and enables event listeners
* @param {Object} ref -  the element/popper reference
*/
function awakenPopper(ref) {
    document.body.appendChild(ref.popper)

    if (!ref.popperInstance) {
        // Create instance if it hasn't been created yet
        ref.popperInstance = createPopperInstance(ref)

        // Follow cursor setting
        if (ref.settings.followCursor && !GLOBALS.touchUser) {
            ref.el.addEventListener('mousemove', followCursor)
            ref.popperInstance.disableEventListeners()
        }
    } else {
        ref.popperInstance.update()

        // Waiting on Popper.js fix. Works in Chrome and FF, but not Safari
        // ===============================================================
        // In cases where the window is resized, the update() method won't always move it
        // back into the viewport properly, it slowly moves back in with each update
        // Here we make updates until it's back in the viewport
        let updateCounter = 0 // 50 max updates
        ;(function shiftIntoViewport() {
            setTimeout(() => {
                ref.popperInstance.scheduleUpdate()
                if (updateCounter < 50 && window.innerWidth <= ref.popper.getBoundingClientRect().right) {
                    shiftIntoViewport()
                }
            }, 0)
            updateCounter++
        })()

        if (!ref.settings.followCursor) {
            ref.popperInstance.enableEventListeners()
        }
    }
}

/**
* Hides all poppers
* @param {Object} - currentRef
*/
function hideAllPoppers(currentRef) {
    STORE.refs.forEach(ref => {
        // Don't hide already hidden ones
        if (!document.body.contains(ref.popper)) return

        // hideOnClick can have the truthy value of 'persistent', so strict check is needed
        const isHideOnClick = ref.settings.hideOnClick === true
        const isNotCurrentRef = !currentRef || ref.popper !== currentRef.popper

        if (isHideOnClick && isNotCurrentRef) {
            ref.tippyInstance.hide(ref.popper, ref.settings.hideDuration)
        }
    })
}

/**
* The class to be exported to be used on the `window`
* Private methods are prefixed with an underscore _
* @param {String|Element|Popper} selector
* @param {Object} settings (optional) - the object of settings to be applied to the instance
*/
export default class Tippy {
    constructor(selector, settings = {}) {

        // Use default browser tooltip on old browsers (IE < 10) and Opera Mini
        if (
            !('addEventListener' in window) ||
            /MSIE 9/i.test(navigator.userAgent) ||
            window.operamini
        ) return

        this.selector = selector
        this.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), settings)
        this.callbacks = {
            wait: settings.wait,
            beforeShown: settings.beforeShown || new Function,
            shown: settings.shown || new Function,
            beforeHidden: settings.beforeHidden || new Function,
            hidden: settings.hidden || new Function
        }

        let els
        // Check what the selector is
        if (selector instanceof Element) {
            els = [selector]
        } else if (selector instanceof Popper) {
            els = [selector.reference]
        } else {
            els = [].slice.call(document.querySelectorAll(selector))
        }

        this._createTooltips(els)
    }

    /**
    * Returns an object of settings to override global settings
    * @param {Element} el - the tooltipped element
    * @return {Object} - individual settings
    */
    _applyIndividualSettings(el) {
        const settings = {}

        DEFAULTS_KEYS.forEach(key => {
            let val = el.getAttribute(`data-${ key.toLowerCase() }`) || this.settings[key]
            if (val === 'false') val = false

            settings[key] = val
        })

        // animateFill is disabled if an arrow is true
        if (settings.arrow) settings['animateFill'] = false

        return Object.assign({}, this.settings, settings)
    }

    /**
    * Returns relevant listener callbacks for each ref
    * @param {Element} el
    * @param {Element} popper
    * @param {Object} settings
    * @return {Object} - relevant listener callback methods
    */
    _getEventListenerHandlers(el, popper, settings) {

        const clearTimeouts = () => {
            clearTimeout(popper.getAttribute('data-delay'))
            clearTimeout(popper.getAttribute('data-hidedelay'))
        }

        const _show = () => {
            clearTimeouts()

            // Already visible. For clicking when it also has a `focus` event listener
            if (popper.style.visibility === 'visible') return

            if (settings.delay) {
                const delay = setTimeout(
                    () => this.show(popper, settings.duration),
                    settings.delay
                )
                popper.setAttribute('data-delay', delay)
            } else {
                this.show(popper, settings.duration)
            }
        }

        const show = event => this.callbacks.wait ? this.callbacks.wait(_show, event) : _show()

        const hide = () => {
            clearTimeouts()

            if (settings.hideDelay) {
                const delay = setTimeout(
                    () => this.hide(popper, settings.hideDuration),
                    settings.hideDelay
                )
                popper.setAttribute('data-hidedelay', delay)
            } else {
                this.hide(popper, settings.hideDuration)
            }
        }

        const handleTrigger = event => {
            // Toggle show/hide when clicking click-triggered tooltips
            const isClick = event.type === 'click'
            const isVisible = popper.style.visibility === 'visible'
            const isNotPersistent = settings.hideOnClick !== 'persistent'

            isClick && isVisible && isNotPersistent ? hide() : show(event)
        }

        const handleMouseleave = event => {
            if (settings.interactive) {
                // Temporarily handle mousemove to check if the mouse left somewhere
                // other than its popper
                const handleMousemove = event => {
                    const isOverPopper = closest(event.target, SELECTORS.popper) === popper
                    const isOverEl = closest(event.target, SELECTORS.el) === el
                    const isClickTriggered = settings.trigger.indexOf('click') !== -1

                    if (isOverPopper || isOverEl || isClickTriggered) return

                    // Firefox (and maybe other browsers) do not reliably place the popper
                    // directly next to the element, use 2px padding to ensure the cursor is far
                    // enough away
                    const popperRect = popper.getBoundingClientRect()
                    const padding = 2

                    if (
                        Math.abs(event.clientY - popperRect.bottom) >= padding &&
                        Math.abs(event.clientY - popperRect.top) >= padding &&
                        Math.abs(event.clientX - popperRect.left) >= padding &&
                        Math.abs(event.clientX - popperRect.right) >= padding
                    ) {
                        document.removeEventListener('mousemove', handleMousemove)
                        hide()
                    }
                }
                return document.addEventListener('mousemove', handleMousemove)
            }

            // If it's not interactive, just hide it
            hide()
        }

        const handleBlur = event => {
            // Only hide if not a touch user and has a focus 'relatedtarget', of which is not
            // a popper element
            if (GLOBALS.touchUser || !event.relatedTarget) return
            if (closest(event.relatedTarget, SELECTORS.popper)) return

            hide()
        }

        return {
            handleTrigger,
            handleMouseleave,
            handleBlur
        }
    }

    /**
    * Creates tooltips for all elements that match the instance's selector
    * @param {Array} els - Elements
    */
    _createTooltips(els) {
        els.forEach(el => {            
            const settings = this._applyIndividualSettings(el)

            const title = el.title
            if (!title && !settings.html) return

            const id = GLOBALS.idCounter
            el.setAttribute('data-tooltipped', '')
            el.setAttribute('aria-describedby', `tippy-tooltip-${id}`)

            removeTitle(el)

            const popper = createPopperElement(id, title, settings)
            const handlers = this._getEventListenerHandlers(el, popper, settings)
            let listeners = []

            settings.trigger.trim().split(' ').forEach(
                event => listeners = listeners.concat(createTrigger(event, el, handlers))
            )

            pushIntoStorage({
                id,
                el,
                popper,
                settings,
                listeners,
                tippyInstance: this,
                popperInstance: this.selector instanceof Popper ? this.selector : undefined
            })
            
            GLOBALS.idCounter++
        })

        Tippy.store = STORE // Allow others to access `STORE` if need be
    }

    /**
    * Returns a tooltipped element's popper reference
    * @param {Element} el
    * @return {Element}
    */
    getPopperElement(el) {
        try {
            return find(STORE.refs, ref => ref.el === el).popper
        } catch (e) {
            throw new Error('[Tippy error]: Element does not exist in any Tippy instances')
        }
    }

    /**
    * Returns a popper's tooltipped element reference
    * @param {Element} popper
    * @return {Element}
    */
    getTooltippedElement(popper) {
        try {
            return find(STORE.refs, ref => ref.popper === popper).el
        } catch (e) {
            throw new Error('[Tippy error]: Popper does not exist in any Tippy instances')
        }
    }

    /**
    * Shows a popper
    * @param {Element} popper
    * @param {Number} duration (optional)
    * @param {Boolean} enableCallback (optional)
    */
    show(popper, duration = this.settings.duration, enableCallback = true) {
        const ref = find(STORE.refs, ref => ref.popper === popper)
        const tooltip = popper.querySelector(SELECTORS.tooltip)
        const circle = popper.querySelector(SELECTORS.circle)

        if (enableCallback) {
            this.callbacks.beforeShown()

            // Flipping causes CSS transition to go haywire
            correctTransition(ref, () => {
                this.hide(popper, 0, false)
                setTimeout(() => {
                    if (ref.hidden) return
                    this.show(popper, duration, false)
                }, 0)
            })
        }

        if (!document.body.contains(popper)) {
            awakenPopper(ref)
        }

        // Interactive tooltips receive a class of 'active'
        if (ref.settings.interactive) {
            ref.el.classList.add('active')
        }

        ref.hidden = false
        ref.popper.style.visibility = 'visible'
        ref.popper.setAttribute('aria-hidden', 'false')

        // Repaint/reflow is required for CSS transition when appending
        triggerReflow(tooltip, circle)

        modifyClassList([tooltip, circle], list => {
            list.remove('leave')
            list.add('enter')
        })

        applyTransitionDuration([tooltip, circle], duration)

        // Wait for transitions to complete
        onTransitionEnd(ref, duration, () => {
            if (!isExpectedState(popper, 'show') || ref.onShownFired) return

            if (!ref.settings.transitionFlip) {
                tooltip.classList.add('tippy-notransition')
            }

            // Focus interactive tooltips only
            if (ref.settings.interactive) {
                popper.focus()
            }

            // Prevents shown() from firing more than once from early transition cancellations
            ref.onShownFired = true

            if (enableCallback) this.callbacks.shown()
        })
    }

    /**
    * Hides a popper
    * @param {Element} popper
    * @param {Number} duration (optional)
    * @param {Boolean} enableCallback (optional)
    */
    hide(popper, duration = this.settings.duration, enableCallback = true) {
        const ref = find(STORE.refs, ref => ref.popper === popper)
        const tooltip = popper.querySelector(SELECTORS.tooltip)
        const circle = popper.querySelector(SELECTORS.circle)
        const content = popper.querySelector(SELECTORS.content)

        if (enableCallback) {
            this.callbacks.beforeHidden()
            
            ref.el.classList.remove('active')

            ref.onShownFired = false
            
            ref.flipped = (ref.settings.position !== popper.getAttribute('x-placement'))
            
            ref.hidden = true

            if (!ref.settings.transitionFlip) {
                tooltip.classList.remove('tippy-notransition')
            }
        }

        popper.style.visibility = 'hidden'
        popper.setAttribute('aria-hidden', 'true')

        // Use same duration as show if it's the default
        if (duration === DEFAULTS.hideDuration) {
            duration = parseInt(tooltip.style[prefix('transitionDuration')])
        } else {
            applyTransitionDuration([tooltip, circle], duration)
        }

        modifyClassList([tooltip, circle], list => {
            list.remove('enter')
            list.add('leave')
        })

        // Re-focus click-triggered html elements
        // and the tooltipped element IS in the viewport (otherwise it causes unsightly scrolling
        // if the tooltip is closed and the element isn't in the viewport anymore)
        if (ref.settings.html &&
            ref.settings.trigger.indexOf('click') !== -1 &&
            elementIsInViewport(ref.el)) {
            ref.el.focus()
        }

        // Wait for transitions to complete
        onTransitionEnd(ref, duration, () => {
            if (!isExpectedState(popper, 'hide') || !document.body.contains(popper)) return

            ref.popperInstance.disableEventListeners()
            
            ref.flipped = (ref.settings.position !== popper.getAttribute('x-placement'))

            document.body.removeChild(popper)

            if (enableCallback) this.callbacks.hidden()
        })
    }

    /**
    * Destroys a popper
    * @param {Element} popper
    */
    destroy(popper) {
        const ref = find(STORE.refs, ref => ref.popper === popper)

        // Remove Tippy-only event listeners from tooltipped element
        ref.listeners.forEach(
            listener => ref.el.removeEventListener(listener.event, listener.handler)
        )

        ref.el.removeAttribute('data-tooltipped')
        ref.el.removeAttribute('aria-describedby')

        if (ref.popperInstance) ref.popperInstance.destroy()

        // Remove from storage
        STORE.refs.splice(STORE.refs.map(ref => ref.popper).indexOf(popper), 1)
    }

    /**
    * Updates a popper with new content
    * @param {Element} popper
    */
    update(popper) {
        const ref = find(STORE.refs, ref => ref.popper === popper)
        const content = popper.querySelector(SELECTORS.content)
        const template = ref.settings.html

        if (template) {
            content.innerHTML = (template instanceof Element)
                                ? template.innerHTML
                                : document.getElementById(template.replace('#', '')).innerHTML
        } else {
            content.innerHTML = ref.el.getAttribute('title') || ref.el.getAttribute('data-original-title')
            removeTitle(ref.el)
        }
    }
}
