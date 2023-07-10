
1. clone https://github.com/facebook/flipper
2. start the dev mode of flipper
    1. cd flipper
    2. yarn start
3. clone FlipperExpandablePreferencesiOS
    1. cd FlipperExpandablePreferencesiOS
    2. pod install --project-directory=Example
    3. run the example project
4. clone flipper-plugin-expandablepreferences
    1. edit ~/.flipper/config.json. add the parent folder of flipper-plugin-expandablepreferences to 'pluginPaths'
    2. cd flipper-plugin-expandablepreferences
    3. npm install
    4. yarn watch


