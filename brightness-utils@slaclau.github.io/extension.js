import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as BrightnessSliders from './quicksettings/BrightnessSliders.js';
//import * as PrivacyMenu from './quicksettings/PrivacyMenu.js';

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
const QuickSettingsGrid = QuickSettingsMenu.menu._grid;


export default class MyExtension extends Extension {
    enable() {
        console.log('Enable extension');

        this.features = [];

        this.features.push(new BrightnessSliders.BrightnessSlidersFeature());
//        this.features.push(new PrivacyMenu.PrivacyToggleFeature());

        let gridChildren = QuickSettingsGrid.get_children();
        let addIndex;
        for (let index = 0; index < gridChildren.length; index++) {
            if (gridChildren[index]?.constructor?.name === 'NMWiredToggle') {
                addIndex = index - 1;
            }
        }
        //this.loadFeatureAtIndex(1, addIndex);
        this.loadFeatureAtIndex(0, addIndex);
        for (let index = 0; index < gridChildren.length; index++) {
            if (gridChildren[index]?.constructor?.name === 'RfkillToggle') {
                addIndex = index;
            }
        }
        console.log('Removing unneeded items');
        this.removeUnneeded();
    }

    disable() {
        console.log('Disable extension');

        for (let feature of this.features) {
            feature.unload();
        }
    }

    loadFeatureAtIndex(featureIndex, addIndex) {
        let children = QuickSettingsGrid.get_children();
        let tmp = [];
        let tmp_visible = [];
        for (let index = addIndex + 1; index < children.length; index++) {
            let item = children[index];
            tmp.push(item);
            tmp_visible.push(item.visible);
            QuickSettingsGrid.remove_child(item);
        }
        console.log(this.features)
        this.features[featureIndex].load();
        for (let index = 0; index < tmp.length; index++) {
            let item = tmp[index];
            QuickSettingsGrid.add_child(item);
            item.visible = tmp_visible[index];
        }
    }

    removeUnneeded() {
        let children = QuickSettingsGrid.get_children();
        for (let index = 0; index < children.length; index++) {
            let item = children[index];
            if (
                item.constructor?.name === 'BrightnessItem' ||
                item.constructor?.name === 'NightLightToggle'
                //|| item.constructor?.name == "DarkModeToggle"
            ) {
                QuickSettingsGrid.remove_child(item);
            }
        }
    }
}
