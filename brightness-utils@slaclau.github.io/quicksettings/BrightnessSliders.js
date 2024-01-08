import * as DDC from '../services/ddc.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as Panel from 'resource:///org/gnome/shell/ui/panel.js';

import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';
import * as DateUtils from 'resource:///org/gnome/shell/misc/dateUtils.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

const BoxLayout = St.BoxLayout;
const Label = St.Label;

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
const QuickSettingsGrid = QuickSettingsMenu.menu._grid;

const P_BUS_NAME = 'org.gnome.SettingsDaemon.Power';
const P_OBJECT_PATH = '/org/gnome/SettingsDaemon/Power';

const BrightnessInterface = loadInterfaceXML(
    'org.gnome.SettingsDaemon.Power.Screen'
);

const C_BUS_NAME = 'org.gnome.SettingsDaemon.Color';
const C_OBJECT_PATH = '/org/gnome/SettingsDaemon/Color';

const ColorInterface = `<node>
  <interface name="org.gnome.SettingsDaemon.Color">
    <property name="DisabledUntilTomorrow" type="b" access="readwrite"/>
    <property name="NightLightActive" type="b" access="read"/>
    <property name="Sunrise" type="d" access="read"/>
    <property name="Sunset" type="d" access="read"/>
    <method name="NightLightPreview">
      <arg type="u" name="duration" direction="in"/>
    </method>
  </interface>
</node>`;


const COLOR_SCHEMA = 'org.gnome.settings-daemon.plugins.color';
const includeNL = false;

export class BrightnessSlidersFeature {
    constructor() {
        console.log('Constructing BrightnessSlidersFeature')
    }
    load() {
        console.log('Loading BrightnessSlidersFeature');
        try {
            this.displays = DDC.getDisplays();
        } catch (error) {
            console.error(error);
            this.displays = null;
        }
        this.addDisplaySliders(this.displays);
    }

    unload() {
        console.log('Unloading BrightnessSlidersFeature');
        this.feature.destroy();
    }

    addDisplaySliders(displays) {
        this.feature = new Feature(displays);
    }
};

const BrightnessSlider = GObject.registerClass(
    class BrightnessSlider extends PopupMenu.PopupImageMenuItem {
        _init(bus, name, current, max, master) {
            super._init(name, 'display-brightness-symbolic', {});

            this.bus = bus;
            this.name = name;
            this.current = current;
            this.max = max;
            this.timeout = null;
            this.master = master;
            this.slider = new Slider.Slider(current / max);
            this.slider.connect('notify::value', item => {
                this._setBrightness(item._value);
            });
            this.connect('destroy', this._onDestroy.bind(this));
            this.add(this.slider);
        }

        setValue(value) {
            this.slider.value = value;
        }

        _ratioToBrightness(ratio) {
            return parseInt(ratio * this.max);
        }

        _setBrightness(sliderValue) {
            let brightness = this._ratioToBrightness(sliderValue);
            console.log(`Setting ${this.name} to ${brightness}`);
            if (this.timeout) {
                GLib.Source.remove(this.timeout);
                this.timeout = null;
            }
            this.timeout = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                DDC.setDisplayBrightness(this.bus, brightness);
            });
            this.master.sync();
        }

        _onDestroy() {
            if (this.timeout) {
                GLib.Source.remove(this.timeout);
                this.timeout = null;
            }
        }
    }
);

const MasterSlider = GObject.registerClass(
    class MasterSlider extends QuickSettings.QuickSlider {
        _init(displays) {
            super._init({
                iconName: 'display-brightness-symbolic',
            });

            this.setMode = 'init';
            this.pauseSync = false;
            this.syncing = false;
            this.slider.connect('notify::value', item => {
                this._setBrightness(item._value);
            });

            this.menuEnabled = true;
            this.menu.setHeader('display-brightness-symbolic', 'Brightness');
            this.subSliders = [];

            const builtinSlider = new BuiltinSlider(this);
            this.menu.addMenuItem(builtinSlider);
            this.subSliders.push(builtinSlider);
            console.log('Added built in slider');
            console.log(displays)
            this._add_displays(displays);
            if (includeNL) {
                addNightLightMenu(this)
            }
            this.settingsSeparator = new PopupMenu.PopupSeparatorMenuItem('Settings')
            this.menu.addMenuItem(
                this.settingsSeparator
            );
            this.reloadButton = new PopupMenu.PopupMenuItem('Reload displays');
            this.reloadButton.connect('activate', item => {
                console.log('Reload');
                for (let i = 1; i < this.subSliders.length; i++) {
                    this.subSliders[i].destroy()
                }
                try {
                    this.displays = DDC.getDisplays();
                } catch (error) {
                    console.error(error);
                    this.displays = null;
                }
                this._add_displays(displays);
            });
            this.menu.addMenuItem(this.reloadButton);
            this.setMode = 'same';
            console.log('Master slider init');
        }

        _add_displays(displays) {
            if (displays) {
                let i = 1;
                for (let display of displays) {
                    console.log('Found ' + display.name);
                    // Create the slider and associate it with the indicator, being sure to
                    // destroy it along with the indicator
                    this.subSlider = new BrightnessSlider(
                        display.bus,
                        display.name,
                        display.current,
                        display.max,
                        this
                    );
                    this.subSliders.push(this.subSlider);
                    this.menu.addMenuItem(this.subSlider, i);
                    i++;
                }
            }
        }

        setValue(value) {
            this.slider.value = value;
        }

        _setBrightness(sliderValue) {
            if (!this.syncing) {
                this.pauseSync = true;
                if (this.setMode == 'same') {
                    let subSliders = this.subSliders;
                    for (let subSlider of subSliders) {
                        subSlider.setValue(sliderValue);
                    }
                }
                this.pauseSync = false;
            }
        }

        sync() {
            this.syncing = true;
            if (!this.pauseSync) {
                let subSliders = this.subSliders;
                let total = 0;
                for (let subSlider of subSliders) {
                    total += subSlider.slider.value;
                }
                let mean = total / subSliders.length;
                this.setValue(mean);
            } else {
            }
            if (includeNL) {
                let disabled = this._proxy.DisabledUntilTomorrow;
                this._disableItem.label.text = disabled
                    ? _('Resume')
                    : _('Disable Until Tomorrow');
            }
            this.syncing = false;
        }
    }
);

const NightLightQMT = GObject.registerClass(
    class NightLightQMT extends QuickSettings.QuickMenuToggle {
        _init(extensionObject) {
            super._init({
                title: 'Night Light',
                iconName: 'night-light-symbolic',
                toggleMode: true,
            });

            // Add a header with an icon, title and optional subtitle. This is
            // recommended for consistency with other quick settings menus.
            this.menu.setHeader('night-light-symbolic', 'Night Light');
            addNightLightMenu(this)

            this._nlsettings = new Gio.Settings({
                schema_id: 'org.gnome.settings-daemon.plugins.color',
            });

            this._nlsettings.bind(
                'night-light-enabled',
                this,
                'checked',
                Gio.SettingsBindFlags.DEFAULT
            );

            this._nlsettings.connect('changed::night-light-enabled', () =>
                this.sync()
            );

        }

        sync() {
            this.syncing = true;
            let paused = this._proxy.DisabledUntilTomorrow;
            this._disableItem.label.text = paused
                ? _('Resume')
                : _('Disable Until Tomorrow');
            let disabled = !this.checked;
            let subtitle_1 = disabled ? _('Disabled') : ( paused ? _('Paused') : _('Enabled') )

            let active = this._proxy.NightLightActive
            let subtitle_2 = active ? _('On') : _('Off')
            this.subtitle = ( disabled || paused ) ? subtitle_1 : subtitle_1 + '; ' + subtitle_2
            this.syncing = false;
        }
    }
);


function addNightLightMenu(parent) {
    parent.menu.addMenuItem(
        new PopupMenu.PopupSeparatorMenuItem('Night light')
    );
    parent.nightLightToggle = new NightLightToggle();
    parent.menu.addMenuItem(parent.nightLightToggle);

    const ColorProxy = Gio.DBusProxy.makeProxyWrapper(ColorInterface);
    parent._proxy = new ColorProxy(
        Gio.DBus.session,
        C_BUS_NAME,
        C_OBJECT_PATH,
        (proxy, error) => {
            if (error) {
                console.log(error.message);
                return;
            }
            parent._proxy.connect(
                'g-properties-changed',
                parent.sync.bind(parent)
            );
            parent.sync();
        }
    );

    parent._disableItem = parent.menu.addAction('', () => {
        parent._proxy.DisabledUntilTomorrow =
            !parent._proxy.DisabledUntilTomorrow;
        parent.nightLightToggle._sync();
    });

    parent.nightLightSlider = new NightLightSlider({
        minimum: 1000,
        maximum: 10000,
        swapAxis: false,
        showAlways: true,
    });
    parent.menu.addMenuItem(parent.nightLightSlider);

    parent._previewItem = parent.menu.addAction('Preview', () => {
        console.log(ColorInterface)
        parent._proxy.NightLightPreviewRemote(10, (returnValue, errorObj, fdList) => {
            if (errorObj === null) {
                console.log(returnValue);
            } else {
                logError(errorObj);
            }
        });
    });
}

const NightLightToggle = GObject.registerClass(
    class NightLightToggle extends PopupMenu.PopupSwitchMenuItem {
        _init() {
            super._init('Enabled', false, {});

            this._nlsettings = new Gio.Settings({
                schema_id: 'org.gnome.settings-daemon.plugins.color',
            });

            this._nlsettings.bind(
                'night-light-enabled',
                this._switch,
                'state',
                Gio.SettingsBindFlags.DEFAULT
            );
            this._nlsettings.connect('changed::night-light-enabled', () =>
                this._sync()
            );
        }

        _sync() {
            this.setToggleState(
                this._nlsettings.get_boolean('night-light-enabled')
            );
        }
    }
);

const BuiltinSlider = GObject.registerClass(
    class BuiltinSlider extends PopupMenu.PopupImageMenuItem {
        _init(master) {
            super._init('Built in', 'display-brightness-symbolic', {});
            this.master = master;
            this.slider = new Slider.Slider(0);
            this.add(this.slider);
            const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(BrightnessInterface);
            this._proxy = new BrightnessProxy(
                Gio.DBus.session,
                P_BUS_NAME,
                P_OBJECT_PATH,
                (proxy, error) => {
                    if (error) console.error(error.message);
                    else
                        this._proxy.connect('g-properties-changed', () =>
                            this._sync()
                        );
                    this._sync();
                }
            );

            this._sliderChangedId = this.slider.connect(
                'notify::value',
                this._sliderChanged.bind(this)
            );
            this.slider.accessible_name = _('Brightness');
        }

        _sliderChanged() {
            const percent = this.slider.value * 100;
            this._proxy.Brightness = percent;
        }

        _setBrightness(value) {
            this.slider.block_signal_handler(this._sliderChangedId);
            this.slider.value = value;
            this.slider.unblock_signal_handler(this._sliderChangedId);
        }

        setValue(value) {
            this.slider.value = value;
        }

        _sync() {
            const brightness = this._proxy.Brightness;
            const visible = Number.isInteger(brightness) && brightness >= 0;
            this.visible = visible;
            if (visible) this._setBrightness(this._proxy.Brightness / 100.0);
            this.master.sync();
        }
    }
);

const NightLightSlider = GObject.registerClass(
    class NightLightSlider extends PopupMenu.PopupImageMenuItem {
        _init(options) {
            super._init('', 'night-light-symbolic', {});
            this._options = options;
            this._settings = new Gio.Settings({schema_id: COLOR_SCHEMA});
            this._slider = new Slider.Slider(0);
            this._sync = debounce(this.__sync.bind(this), 500);
            this.add(this._slider);

            this._sliderChangedId = this._slider.connect(
                'notify::value',
                this._sliderChanged.bind(this)
            );
            this._slider.accessible_name = _('Brightness');
            this.connect('destroy', this._onDestroy.bind(this));
            this._settings.connect('changed::night-light-temperature', () =>
                this._sync()
            );
            this._sync();
        }

        _sliderChanged() {
            const {swapAxis, minimum, maximum} = this._options;
            const percent = swapAxis
                ? 1 - this._slider.value
                : this._slider.value;
            const temperature = percent * (maximum - minimum) + minimum;
            console.log('Setting colour temperature to ' + temperature);

            // Update GSettings
            this._settings.set_uint('night-light-temperature', temperature);
        }

        _changeSlider(value) {
            this._slider.block_signal_handler(this._sliderChangedId);
            this._slider.value = value;
            this._slider.unblock_signal_handler(this._sliderChangedId);
        }

        __sync() {
            const {showAlways, swapAxis, minimum, maximum} = this._options;
            const active = true;

            if (active) {
                const temperature = this._settings.get_uint(
                    'night-light-temperature'
                );
                const percent = (temperature - minimum) / (maximum - minimum);
                console.log(`temp ${temperature}, min ${minimum}, max ${maximum}`);
                if (swapAxis) this._changeSlider(1 - percent);
                else this._changeSlider(percent);
            }
        }

        _onDestroy() {
            this._slider = null;
        }
    }
);

const Feature = GObject.registerClass(
    class Feature extends QuickSettings.SystemIndicator {
        _init(displays) {
            super._init();
            let master = new MasterSlider(displays);
            this.quickSettingsItems.push(master);
            let children = QuickSettingsGrid.get_children();
            let sibling = children[2];
            QuickSettingsMenu._addItemsBefore([master], sibling, 2);
            if (!includeNL) {
                let nightLightQMT = new NightLightQMT();
                this.quickSettingsItems.push(nightLightQMT)
                sibling = QuickSettingsMenu._darkMode.quickSettingsItems[0];
                QuickSettingsMenu._addItemsBefore([nightLightQMT], sibling, 1);
            }
            this.connect('destroy', () => {
                this.quickSettingsItems.forEach(item => item.destroy());
            });
        }
    }
);
function debounce(func, wait, options = {priority: GLib.PRIORITY_DEFAULT}) {
    return function (...args) {
        let extensionObject = Extension.lookupByUUID('brightness-utils@slaclau.github.io');
        const debouncedFunc = () => {
            extensionObject.sourceId = null;
            func.apply(this, args);
        };

        // It is a programmer error to attempt to remove a non-existent source
        if (extensionObject.sourceId) GLib.Source.remove(sourceId);
        extensionObject.sourceId = GLib.timeout_add(options.priority, wait, debouncedFunc);
    };
}



