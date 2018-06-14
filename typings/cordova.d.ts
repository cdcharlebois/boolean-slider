type callbackFunction = () => any;

interface Cordova {
    plugins: {
        diagnostic: {
            switchToLocationSettings: any
        }
        locationAccuracy: {
            request: any;
            ERROR_USER_DISAGREED: any;
            REQUEST_PRIORITY_HIGH_ACCURACY: any;
        },
    }
}
declare const cordova: Cordova;