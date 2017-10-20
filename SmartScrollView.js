import React, {
    Component,
} from 'react';

import ReactNative, {
    View,
    StyleSheet,
    ScrollView,
    Keyboard,
    Dimensions,
    LayoutAnimation,
    Platform,
    ViewPropTypes
} from 'react-native';

import PropTypes from "prop-types";

const RCTUIManager = require('NativeModules').UIManager;

const { height: screenHeight } = Dimensions.get('window');
const animations = {
    layout: {
        easeInEaseOut: {
            duration: 250,
                create: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.scaleXY
            },
            update: {
                delay: 0,
                type: LayoutAnimation.Types.easeInEaseOut
            }
        }
    }
};

class SmartScrollView extends Component {

    constructor(){
        super();
        this.scrollPosition = 0;
        this.state = {};
        this._refCreator           = this._refCreator.bind(this);
        this._focusNode            = this._focusNode.bind(this);
        this._keyboardWillHide     = this._keyboardWillHide.bind(this);
        this._keyboardWillShow     = this._keyboardWillShow.bind(this);
        this._updateScrollPosition = this._updateScrollPosition.bind(this);
    }

    componentDidMount() {
        if (this.props.forceFocusField !== this.state.focusedField){
            this._focusField('input_' + this.props.forceFocusField)
        }

        const listeners = [
            Keyboard.addListener(Platform.OS == 'IOS' ? 'keyboardWillShow' : 'keyboardDidShow', this._keyboardWillShow),
            Keyboard.addListener(Platform.OS == 'IOS' ? 'keyboardWillHide' : 'keyboardDidHide', this._keyboardWillHide)
        ]

        if (Platform.OS == 'IOS') {
            listeners.push(Keyboard.addListener('keyboardWillChangeFrame', this._keyboardWillChangeFrame));
        }

        this._listeners = listeners;
    }

    componentWillUpdate(props, state) {
        if (state.keyboardUp !== this.state.keyboardUp) {
            LayoutAnimation.configureNext(animations.layout.easeInEaseOut)
        }
    }

    componentWillReceiveProps(props) {
        if (props.forceFocusField !== undefined && props.forceFocusField !== this.state.focusedField){
            this._focusField('input_' + props.forceFocusField)
        }
    }

    componentWillUnmount() {
        if (this._listeners) {
            this._listeners.forEach((listener) => listener.remove());
        }
    }

    _findScrollWindowHeight(keyboardHeight){
        const {x, y, width, height} = this._layout
        const spaceBelow = (screenHeight - this.props.screenHeightAdjustment) - y - height;
        return height - Math.max(keyboardHeight - spaceBelow, 0);
    }

    _keyboardWillChangeFrame(e) {

        const scrollWindowHeight = this._findScrollWindowHeight(e.endCoordinates.height)

        this.setState({
            scrollWindowHeight
        })
    }

    _keyboardWillShow(e) {

        const scrollWindowHeight = this._findScrollWindowHeight(e.endCoordinates.height)

        this.setState({
            scrollWindowHeight,
            keyBoardUp: true
        }, () => {
            if (this.nodeToFocus) {
                this._focusNode(this.nodeToFocus);
                this.nodeToFocus = undefined;
            }
        })
    }

    _keyboardWillHide() {
        this.setState({
            keyBoardUp: false
        });
        this._smartScroll && this._smartScroll.scrollTo({y: 0});
    }

    _refCreator () {
        const refs = arguments;
        return component => {
            Object.keys(refs).forEach(i => {
                if (typeof refs[i] === 'function') {
                    refs[i](component);
                } else {
                    this[refs[i]] = component;
                }
            })
        }
    }

    _focusField (ref) {
        const node = this[ref];

        if (node) {
            const {type} = node.props.smartScrollOptions;

            switch(type) {
                case 'text':
                    this[ref].focus();
                    break;
                case 'custom':
                    this._focusNode(ref);
            }
        }
    }

    _focusNode (ref) {
        const {
            scrollWindowHeight,
        } = this.state;
        const scrollPosition = this.scrollPosition;
        const {
            scrollPadding,
            onRefFocus
        } = this.props;
        const num = ReactNative.findNodeHandle(this._smartScroll);
        const strippedBackRef = ref.slice('input_'.length);

        setTimeout(() => {

            onRefFocus(strippedBackRef);
            this.setState({focusedField: strippedBackRef})

            const callback = (X,Y,W,H) => {

                const py = Y - scrollPosition;

                if (py + H > scrollWindowHeight) {

                    const nextScrollPosition = (Y + H) - scrollWindowHeight + scrollPadding;

                    this._smartScroll.scrollTo({y: nextScrollPosition});
                    this.scrollPosition = nextScrollPosition;

                } else if (py < 0) {

                    const nextScrollPosition = Y - scrollPadding;

                    this._smartScroll.scrollTo({y: nextScrollPosition});
                    this.scrollPosition = nextScrollPosition;
                }
            }

            RCTUIManager.measureLayout(ReactNative.findNodeHandle(this[ref]), num, callback, callback);
        }, 0);
    }

    _updateScrollPosition (event) {
        this.scrollPosition = event.nativeEvent.contentOffset.y;
    }

    render () {

        console.log("RENDER!");

        const {
            children: scrollChildren,
            contentContainerStyle,
            scrollContainerStyle,
            zoomScale,
            showsVerticalScrollIndicator,
            contentInset,
            onScroll
        } = this.props;

        let inputIndex   = 0;
        
        const smartClone = (element, i) => {

            const { smartScrollOptions } = element.props;
            let smartProps = { key: i };

            if (smartScrollOptions.type !== undefined) {

                const ref = 'input_' + inputIndex;

                smartProps.ref = this._refCreator(ref, smartScrollOptions.scrollRef && 'input_' + smartScrollOptions.scrollRef, element.props.smartRef);

                if (smartScrollOptions.type === 'text') {

                    smartProps.onFocus = () => {
                        smartProps.onFocus = element.props.onFocus && element.props.onFocus();
                        this.nodeToFocus = ref;
                    };

                    if (smartScrollOptions.moveToNext === true) {

                        const nextRef = 'input_' + (inputIndex+1);
                        const focusNextField = () => this._focusField(nextRef)

                        if(typeof(element.props.returnKeyType) === 'undefined'){
                            smartProps.returnKeyType  = 'next'
                        }

                        smartProps.blurOnSubmit = false;
                        smartProps.onSubmitEditing = element.props.onSubmitEditing ?
                        (event) => element.props.onSubmitEditing(event, focusNextField) :
                        focusNextField
                    }
                }

                inputIndex += 1
            }

            return React.cloneElement(element, smartProps)
        }

        function recursivelyCheckAndAdd(children, i) {

            const result = React.Children.map(children, (child, j) => {
                if (child && child.props !== undefined) {
                    if (child.props.smartScrollOptions !== undefined) {
                        return smartClone(child, ''+i+j);
                    } else if (child.props.children !== undefined) {
                        return React.cloneElement(child, {key: i}, recursivelyCheckAndAdd(child.props.children, ''+i+j));
                    } else {
                        return React.cloneElement(child, {key: i});
                    }
                } else {
                    return child
                }
            })

            // If there is only one child return it rather than an array to avoid TouchableHighlight single child issue
            return result.length === 1 ? result[0] : result;
        }

        const content = recursivelyCheckAndAdd(scrollChildren, '0');

        return (
            <View
                ref={ component => this._container=component }
                style={[scrollContainerStyle, this.props.style]}
                onLayout={(e) => this._layout = e.nativeEvent.layout}
            >
                <View
                    style={this.state.keyBoardUp ? { height: this.state.scrollWindowHeight } : styles.flex1}
                >
                    <ScrollView
                        ref = { component => this._smartScroll=component }
                        automaticallyAdjustContentInsets = { false }
                        scrollsToTop = { false }
                        style = { styles.flex1 }
                        onScroll = { (event) => {
                            this._updateScrollPosition(event)
                            onScroll(event)
                        }}
                        scrollEventThrottle = { 16 }
                        contentContainerStyle = { contentContainerStyle }
                        contentInset = { contentInset }
                        zoomScale = { zoomScale }
                        showsVerticalScrollIndicator = { showsVerticalScrollIndicator }
                        keyboardShouldPersistTaps = { 'always' }
                        bounces = { this.props.bounces }
                    >
                        {content}
                    </ScrollView>
                </View>
            </View>
        );
    } 
}

const styles = StyleSheet.create({
    flex1: {
        flexGrow: 1
    }
});

SmartScrollView.propTypes = {
    bounces: PropTypes.bool,
    forceFocusField: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    scrollContainerStyle: ViewPropTypes.style,
    contentContainerStyle: ViewPropTypes.style,
    zoomScale: PropTypes.number,
    showsVerticalScrollIndicator: PropTypes.bool,
    contentInset: PropTypes.object,
    onScroll: PropTypes.func,
    onRefFocus: PropTypes.func,
    screenHeightAdjustment: PropTypes.number
};

SmartScrollView.defaultProps = {
    bounces: false,
    scrollContainerStyle: styles.flex1,
    scrollPadding: 5,
    zoomScale: 1,
    showsVerticalScrollIndicator: true,
    contentInset: {top: 0, left: 0, bottom: 0, right: 0},
    screenHeightAdjustment: 0,
    onScroll: () => {},
    onRefFocus: () => {}
};

export default SmartScrollView;

// import dismissKeyboard from 'dismissKeyboard';
// this._scrollTap            = this._scrollTap.bind(this);
// lastTap:         0
// _scrollTap () {
//   const {lastTap}  = this.state;
//   const currentTap = new Date().getTime();
//   console.log("tap")
//
//   if (currentTap - lastTap < 500) {
//     dismissKeyboard()
//   }
//
//   this.setState({
//     lastTap: currentTap
//   })
// }
