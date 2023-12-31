import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as BrightnessSliders from './quicksettings/BrightnessSliders.js';

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
const QuickSettingsGrid = QuickSettingsMenu.menu._grid;

const removeNL = true;


export default class MyExtension extends Extension {
    enable() {
        console.log('Enable extension');
        this.features = [];

        this.features.push(new BrightnessSliders.BrightnessSlidersFeature());

        for (let index = 0; index < this.features.length; index++) {
            this.features[index].load()
        }
        console.log('Removing unneeded items');
        this.removeUnneeded(true);
    }

    disable() {
        console.log('Disable extension');

        for (let feature of this.features) {
            feature.unload();
        }
        let extensionObject = Extension.lookupByUUID('brightness-utils@slaclau.github.io');
        if (extensionObject.sourceId) {
            GLib.Source.remove(extensionObject.sourceId);
            extensionObject.sourceId = null;
        }
        this.removeUnneeded(false)
    }

    removeUnneeded(doRemove) {
        let children = QuickSettingsGrid.get_children();
        for (let index = 0; index < children.length; index++) {
            let item = children[index];
            if (
                item.constructor?.name === 'BrightnessItem' ||
                (item.constructor?.name === 'NightLightToggle' && removeNL)
            ) {
                //QuickSettingsGrid.remove_child(item);
                item.visible = !doRemove;
            }
        }
    }
}

