# Changelog

## [1.2.0](https://github.com/andrewferrier/quikan/compare/v1.1.1...v1.2.0) (2026-04-22)


### Features

* Add dynamically created screenshot ([13218c1](https://github.com/andrewferrier/quikan/commit/13218c1a7b85b055ca616cd15450aea92b63c8e3))


### Bug Fixes

* Don't commit unless pixels have changed ([887d2f2](https://github.com/andrewferrier/quikan/commit/887d2f2ff5d2805f0498c54ec044010c1b9213bc))
* Don't regen screenshot with tests - closes [#23](https://github.com/andrewferrier/quikan/issues/23) ([3b7a518](https://github.com/andrewferrier/quikan/commit/3b7a518ea5b8637e87f8b61d24f59e711f7c8622))
* Make sure text wraps and doesn't overlap ([7d839d6](https://github.com/andrewferrier/quikan/commit/7d839d69dc8fc90ee00a7eda7c1702d663a762ef))


### Performance Improvements

* Make built image smaller ([c3519fc](https://github.com/andrewferrier/quikan/commit/c3519fc013c46bf63a28f2374ccc354e203e4a2f))

## [1.1.1](https://github.com/andrewferrier/quikan/compare/v1.1.0...v1.1.1) (2026-04-16)


### Bug Fixes

* Move build of Docker to release-please ([853a13c](https://github.com/andrewferrier/quikan/commit/853a13c3c46fbde465615004210e6a4cba36bc11))

## [1.1.0](https://github.com/andrewferrier/quikan/compare/v1.0.0...v1.1.0) (2026-04-16)


### Features

* add hamburger menu with About dialog showing version ([f6cbcb6](https://github.com/andrewferrier/quikan/commit/f6cbcb689e748902a16455362be5e2deaeea73b3))
* Publish quikan images to ghcr ([980d605](https://github.com/andrewferrier/quikan/commit/980d60518dfb03e5a6dcf37b1d211eb08ac3787f))


### Bug Fixes

* Capture version when built as Docker ([62d90ba](https://github.com/andrewferrier/quikan/commit/62d90baf72da7a1f6ca608e3f7e04fa90b1c29dd))
* Include git in Docker ([0c7b87c](https://github.com/andrewferrier/quikan/commit/0c7b87ce9798624cc1c8326b35e72c71d35d17d3))
* Preserve time when card is moved from one column to another ([5e91731](https://github.com/andrewferrier/quikan/commit/5e91731166e068ec64aa9fc6b12ade51db9e7736))
* Show git version in docker ([23c3c84](https://github.com/andrewferrier/quikan/commit/23c3c8492d8cd2bc50e2efd02e84f0c0d69cbc6e))

## 1.0.0 (2026-04-15)


### Features

* Add date clear button - closes [#13](https://github.com/andrewferrier/quikan/issues/13) ([97dfa45](https://github.com/andrewferrier/quikan/commit/97dfa45a1d3f799c03273bffe15512ea866ed828))
* Add more columns and make them dynamic - closes [#12](https://github.com/andrewferrier/quikan/issues/12) ([afe01d5](https://github.com/andrewferrier/quikan/commit/afe01d5ab679e3233a50208859b2027680a91285))
* Add per-column add buttons - closes [#10](https://github.com/andrewferrier/quikan/issues/10) ([e3f2746](https://github.com/andrewferrier/quikan/commit/e3f2746f6da19e2b5e143018616344640f1f1e25))
* Display recurrence pattern - closes [#8](https://github.com/andrewferrier/quikan/issues/8) ([4d37fd9](https://github.com/andrewferrier/quikan/commit/4d37fd976a47e25a78886ba5f48875c90d8267b0))
* Implement 'Delete Card' button ([44681ed](https://github.com/andrewferrier/quikan/commit/44681ed36d9405dcfaf472c3875151944ac74e12))
* Many improvements ([004f901](https://github.com/andrewferrier/quikan/commit/004f901dbaa0cbcceb68dd2a96e2d74687f2b078))
* Tweaks to add/edit dialog - closes [#9](https://github.com/andrewferrier/quikan/issues/9) ([d0df753](https://github.com/andrewferrier/quikan/commit/d0df7536f460ae53ee9e4396454d6316d9709694))


### Bug Fixes

* Build issue ([f2f877f](https://github.com/andrewferrier/quikan/commit/f2f877fbeb0c4623a7c71b586b6bfe656674ce0a))
* Check in package-lock.json ([d11e489](https://github.com/andrewferrier/quikan/commit/d11e48956408f2615c7ee5bdb5f9f7393f093321))
* Consistent UI-facing terminology ([3ce9557](https://github.com/andrewferrier/quikan/commit/3ce9557addebe0874317349f34c13b125d446e17))
* Don't use RFC-based recurrence mechanism, it's not well-handled by other tools ([837ae24](https://github.com/andrewferrier/quikan/commit/837ae24f5ed61e4a434f22fc2ecb37dd964541dd))
* Fix the card editing, and implement basic Playwright test ([8c3df08](https://github.com/andrewferrier/quikan/commit/8c3df08b7fa53e8098d62f32dbe922cf2d60acfe))
* Install chromium for playwright ([09a3949](https://github.com/andrewferrier/quikan/commit/09a39499dfed90b90be337cfc2aac3be4b72b39d))
* Markdown issues - closes [#5](https://github.com/andrewferrier/quikan/issues/5) ([2bacda1](https://github.com/andrewferrier/quikan/commit/2bacda1cc6ae0b87c50c94d613112e8b2e16f8aa))
* npm package versions ([ce594d3](https://github.com/andrewferrier/quikan/commit/ce594d31fb8f9e01aeb94bc5af3552bc64958611))
* Production path ([3ec23e6](https://github.com/andrewferrier/quikan/commit/3ec23e6e70c4a828d5144ba499d287d1cb87c81b))
* Tests ([8fdbdab](https://github.com/andrewferrier/quikan/commit/8fdbdab2dd7cbacccfd709203f802ca19230110e))
* Various loading issues ([ff74ee4](https://github.com/andrewferrier/quikan/commit/ff74ee4f05d5bc40f91e50ea00fcb0a9c94acc62))


### Performance Improvements

* Improve overall performance, get rid of 'Loading...' - closes [#6](https://github.com/andrewferrier/quikan/issues/6), [#7](https://github.com/andrewferrier/quikan/issues/7) ([963f1fc](https://github.com/andrewferrier/quikan/commit/963f1fc36b9c93654916bddac6939a5dea87b06d))
