/**
 * TODO: 
 * @author Conner Charlebois
 * [x] When the switch renders, if the value is true, get the geolocation and update the context object
 * [x] When the switch is set to true, get the geolocation and update the context object
 * @since Jun 14, 2018
 */
import { Component, SFCElement, createElement } from "react";

import { Switch, SwitchProps, SwitchStatus } from "./Switch";
import { Label } from "./Label";
// import "@types/cordova";

interface WrapperProps {
    class?: string;
    mxform: mxui.lib.form._FormBase;
    mxObject?: mendix.lib.MxObject;
    style?: string;
    readOnly?: boolean;
}

interface SwitchContainerProps extends WrapperProps {
    booleanAttribute: string;
    colorStyle: ColorStyle;
    deviceStyle: DeviceStyle;
    editable: "default" | "never";
    label: string;
    labelWidth: number;
    onChangeMicroflow: string;
    onChangeNanoflow: Nanoflow;
    locationEntity: string;
    useLocation: boolean;
}

interface SwitchContainerState {
    alertMessage?: string;
    isChecked?: boolean;
}

interface Nanoflow {
    nanoflow: object[];
    paramsSpec: { Progress: string };
}

type ColorStyle = "default" | "primary" | "inverse" | "info" | "warning" | "success" | "danger";
type DeviceStyle = "auto" | "android" | "iOS";

class SwitchContainer extends Component<SwitchContainerProps, SwitchContainerState> {
    private subscriptionHandles: number[];
    private locationAssc: string;
    private locationEntity: string;


    constructor(props: SwitchContainerProps) {
        super(props);

        this.subscriptionHandles = [];
        const path = this.props.locationEntity.split("/"); // [assc, entity]
        this.locationAssc = path[0];
        this.locationEntity = path[1];
        this.state = this.updateState(props.mxObject);
        this.handleToggle = this.handleToggle.bind(this);
        this.subscriptionCallback = this.subscriptionCallback.bind(this);
        this.handleValidations = this.handleValidations.bind(this);

    }

    render() {
        const maxLabelWidth = 11;
        if (this.props.label.trim()) {
            return createElement(Label, {
                className: `${this.props.deviceStyle} ${this.props.class}`,
                label: this.props.label,
                style: SwitchContainer.parseStyle(this.props.style),
                weight: this.props.labelWidth > maxLabelWidth ? maxLabelWidth : this.props.labelWidth
            }, this.renderSwitch(true));
        }

        return this.renderSwitch();
    }

    componentWillReceiveProps(newProps: SwitchContainerProps) {
        this.resetSubscriptions(newProps.mxObject);
        this.setState(this.updateState(newProps.mxObject));
    }

    componentWillUnmount() {
        this.subscriptionHandles.forEach(mx.data.unsubscribe);
    }

    private renderSwitch(hasLabel = false): SFCElement<SwitchProps> {
        const { class: className, colorStyle, deviceStyle, style, useLocation } = this.props;

        // if true, get the geolocation in the background and create and commit a new location object
        if (this.state.isChecked && useLocation) {
            // create a new location entity and set association
            this.requestGPS();
        }

        return createElement(Switch, {
            alertMessage: this.state.alertMessage,
            className: !hasLabel ? className : undefined,
            colorStyle,
            deviceStyle,
            isChecked: this.state.isChecked,
            onClick: this.handleToggle,
            status: this.getSwitchStatus(!this.isReadOnly()),
            style: !hasLabel ? SwitchContainer.parseStyle(style) : undefined
        } as SwitchProps);
    }

    private getAttributeValue(attribute: string, mxObject?: mendix.lib.MxObject): boolean {
        return !!mxObject && mxObject.get(attribute) as boolean;
    }

    private isReadOnly() {
        const { booleanAttribute, editable, mxObject, readOnly } = this.props;
        if (editable === "default" && mxObject) {
            return readOnly || mxObject.isReadonlyAttr(booleanAttribute);
        }

        return true;
    }

    private getSwitchStatus(enabled: boolean): SwitchStatus {
        if (this.props.mxObject) {
            return enabled ? "enabled" : "disabled";
        }

        return "no-context";
    }

    private handleToggle() {
        const { booleanAttribute, mxObject } = this.props;
        if (mxObject) {
            mxObject.set(booleanAttribute, !mxObject.get(booleanAttribute));
            this.executeAction(mxObject);
        }
    }

    private resetSubscriptions(mxObject?: mendix.lib.MxObject) {
        this.subscriptionHandles.forEach(mx.data.unsubscribe);
        this.subscriptionHandles = [];

        if (mxObject) {
            this.subscriptionHandles.push(mx.data.subscribe({
                callback: this.subscriptionCallback,
                guid: mxObject.getGuid()
            }));

            this.subscriptionHandles.push(mx.data.subscribe({
                attr: this.props.booleanAttribute,
                callback: this.subscriptionCallback,
                guid: mxObject.getGuid()
            }));

            this.subscriptionHandles.push(mx.data.subscribe({
                callback: this.handleValidations,
                guid: mxObject.getGuid(),
                val: true
            }));
        }
    }

    private updateState(mxObject = this.props.mxObject): SwitchContainerState {
        return {
            alertMessage: "",
            isChecked: this.getAttributeValue(this.props.booleanAttribute, mxObject)
        };
    }

    private subscriptionCallback() {
        this.setState(this.updateState());
    }

    private handleValidations(validations: mendix.lib.ObjectValidation[]) {
        const validationMessage = validations[0].getErrorReason(this.props.booleanAttribute);
        validations[0].removeAttribute(this.props.booleanAttribute);
        if (validationMessage) {
            this.setState({ alertMessage: validationMessage });
        }
    }

    private executeAction(mxObject: mendix.lib.MxObject) {
        const { onChangeMicroflow, onChangeNanoflow, mxform } = this.props;

        if (onChangeMicroflow) {
            window.mx.ui.action(onChangeMicroflow, {
                error: error =>
                    window.mx.ui.error(`Error while executing microflow ${onChangeMicroflow}: ${error.message}`),
                origin: mxform,
                params: {
                    applyto: "selection",
                    guids: [mxObject.getGuid()]
                }
            });
        }

        if (onChangeNanoflow && onChangeNanoflow.nanoflow) {
            const context = new mendix.lib.MxContext();
            context.setContext(mxObject.getEntity(), mxObject.getGuid());
            window.mx.data.callNanoflow({
                context,
                error: error =>
                    window.mx.ui.error(`Error while executing the on change nanoflow: ${error.message}`),
                nanoflow: onChangeNanoflow,
                origin: mxform
            });
        }
    }

    public static parseStyle(style = ""): { [key: string]: string } {
        try {
            return style.split(";").reduce<{ [key: string]: string }>((styleObject, line) => {
                const pair = line.split(":");
                if (pair.length === 2) {
                    const name = pair[0].trim().replace(/(-.)/g, match => match[1].toUpperCase());
                    styleObject[name] = pair[1].trim();
                }
                return styleObject;
            }, {});
        } catch (error) {
            // tslint:disable-next-line no-console
            window.console.error("Failed to parse style", style, error);
        }

        return {};
    }

    private requestGPS() {
        cordova.plugins.locationAccuracy.request(
            this.onAcceptGPS.bind(this),
            this.onLocationFailure.bind(this), cordova.plugins.locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY);
    }

    private onAcceptGPS(success: any) {
        console.log("Successfully requested accuracy: " + success.message);
        navigator.geolocation.getCurrentPosition(
            this.onLocationSuccess.bind(this),
            this.onLocationFailure.bind(this)
        );
    }

    private onLocationSuccess(position: any) {
        this.createAndCommitLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
        })
    }

    private onLocationFailure(err: any) {
        const { booleanAttribute, mxObject } = this.props;
        console.error("Could not get location", err);
        if (mxObject) {
            mxObject.set(booleanAttribute, false);
        }
    }

    private createAndCommitLocation(coords: any) {
        const { mxObject } = this.props;
        mx.data.create({
            entity: this.locationEntity,
            callback: obj => {
                console.log("Object created on server");
                obj.set(this.locationAssc, mxObject && mxObject.getGuid());
                obj.set("Latitude", coords.lat);
                obj.set("Longitude", coords.lng);
                console.log("committing the object...");
                console.log(obj);
                mx.data.commit({
                    mxobj: obj,
                    callback: () => { console.log("Location committed") },
                    error: (err) => { console.log("Location failed to commit", err) }
                })
            },
            error: e => {
                console.error("Could not commit object:", e);
            }
        });
    }
}

export { ColorStyle, DeviceStyle, SwitchContainer as default, SwitchContainerProps };
