var game;
var shootPeriodMs = 190;
var obstaclesVelocity = 300;
var keyHighscore = "highscore";
var saveHighscoreBetweenSessions = false;
var Game = (function () {
    function Game() {
        game = new Phaser.Game(500, 150, Phaser.CANVAS, "phaser-game", new Loader(), true, false);
    }
    return Game;
}());

function uploadMD() {
  var content = document.getElementById('mdContent').value;
  window.safeMutableData.newRandomPublic(window.auth, 15001)
  .then(mdHandle => window.safeMutableData.quickSetup(mdHandle, {key1: content}))
  .then(mdHandle => {
    window.safeMutableData.get(mdHandle, 'key1')
    .then(value => {
      var utfString = String.fromCharCode.apply(null, new Uint8Array(value.buf));
      var parEl = document.getElementById('output');
      var childEl = document.createElement('div');
      childEl.textContent = utfString;
      parEl.appendChild(childEl);
    })
  })
}

var Loader = (function () {
    function Loader() {
    }
    Loader.prototype.preload = function () {
        game.load.spritesheet("player", "sprites/Player.png", 32, 32);
        game.load.image("obstacle", "sprites/Obstacle.png");
        game.load.image("target", "sprites/Target.png");
        game.load.image("restart", "sprites/Restart.png");
        game.load.image("bullet", "sprites/Bullet.png");
        game.load.spritesheet("clouds", "sprites/Clouds.png", 64, 64);
        game.load.spritesheet("ground", "sprites/Ground.png", 64, 64);
    };
    Loader.prototype.create = function () {
        game.state.add("mainState", new State(), true);
    };
    return Loader;
}());
var State = (function () {
    function State() {
    }
    State.prototype.init = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var fontSize = 16;
        var style = { boundsAlignH: "right", fill: "#76e176", fontSize: fontSize };
        this.scoreTextCurrent = game.add.text(0, 0, "0", style);
        this.scoreTextHighest = game.add.text(0, fontSize, "", style);
        this.scoreTextCurrent.textBounds = this.scoreTextHighest.textBounds =
            new Phaser.Rectangle(0, 8, game.width - 16, 32);
        this.scoreTextHighest.fontSize = fontSize / 1.5;
        if (args.length === 0) {
            var hi = saveHighscoreBetweenSessions ? localStorage.getItem(keyHighscore) : null;
            if (hi == null) {
                this.scoreHighest = 0;
                this.scoreTextHighest.visible = false;
                return;
            }
            this.scoreHighest = parseInt(hi);
        }
        else {
            this.scoreHighest = args[0];
        }
        this.scoreTextHighest.visible = true;
        this.scoreTextHighest.text = this.scoreHighest.toString();
    };
    ;
    State.prototype.create = function () {
        game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        game.renderer.renderSession.roundPixels = true;
        Phaser.Canvas.setImageRenderingCrisp(game.canvas);
        game.stage.smoothed = false;
        game.onPause.add(this.pause, this);
        game.onResume.add(this.resume, this);
        this.pauseElapsedSeconds = 0;
        this.background = new Array();
        this.obstacles = new Array();
        this.targets = new Array();
        this.bullets = new Array();
        game.physics.startSystem(Phaser.Physics.ARCADE);
        this.groupGround = game.add.group();
        this.groupBackground = game.add.group();
        this.groupForeground = game.add.group();
        this.groupUi = game.add.group();
        this.groupGround.enableBody = true;
        var ground = this.groupGround.create(0, game.world.height - 32, null);
        ground.body.immovable = true;
        ground.body.setSize(game.world.width, 32);
        this.createGroundSprites();
        this.player = this.groupForeground.create(32, game.world.height - 64, "player");
        game.physics.arcade.enable(this.player);
        this.player.body.gravity.y = 1000;
        this.player.body.collideWorldBounds = true;
        this.player.animations.add("walk", [0, 1, 2, 3], 10, true);
        this.player.animations.add("jump", [4], 10, true);
        this.player.animations.add("shoot", [5, 6, 7], 10, true);
        this.cursors = game.input.keyboard.createCursorKeys();
        game.input.mouse.capture = true;
        this.nextObstacle = 3;
        this.nextTarget = this.nextObstacle + 2.25;
        this.nextCloud = 0;
        this.scoreTextHighest.text = this.scoreTextHighest.text;
        this.scoreTargets = 0;
    };
    State.prototype.pause = function () {
        this.pauseStartSeconds = game.time.totalElapsedSeconds();
    };
    State.prototype.resume = function () {
        this.pauseElapsedSeconds += (game.time.totalElapsedSeconds() - this.pauseStartSeconds);
    };
    State.prototype.createGroundSprites = function () {
        var groundSprite = this.groupBackground.create(0, 0, "ground");
        var w = groundSprite.width;
        this.groundY = game.height - groundSprite.height;
        groundSprite.destroy();
        this.background.push(groundSprite);
        for (var i = 0; i < game.width + w; i += w) {
            this.lastGround = this.createBackground(i, this.groundY, "ground", obstaclesVelocity);
            this.lastGround.events.onDestroy.add(this.createGroundSprite, this);
        }
    };
    State.prototype.createGroundSprite = function () {
        var x = this.lastGround.x + this.lastGround.width + this.lastGround.body.velocity.x / 50;
        this.lastGround = this.createBackground(x, this.groundY, "ground", obstaclesVelocity);
        this.lastGround.events.onDestroy.add(this.createGroundSprite, this);
    };
    State.prototype.createBackground = function (x, y, sprite, velocity) {
        var back = this.groupBackground.create(x, y, sprite);
        back.animations.add("a");
        back.animations.play("a", 0, false);
        back.animations.frame =
            Math.floor(Phaser.Math.random(0, back.animations.currentAnim.frameTotal));
        game.physics.arcade.enable(back);
        back.body.velocity.x = -velocity;
        this.background.push(back);
        return back;
    };
    State.prototype.update = function () {
        var hitGround = game.physics.arcade.collide(this.player, this.groupGround);
        if (this.player.body.touching.down) {
            this.player.animations.play("walk");
            if (hitGround && this.cursors.up.isDown || game.input.activePointer.isDown) {
                this.player.body.velocity.y = -400;
                if (this.bulletsTimer != undefined)
                    this.bulletsTimer.destroy();
                this.bulletsTimer = game.time.create(false);
                this.bulletsTimer.loop(shootPeriodMs, this.createBullet, this);
                this.bulletsTimer.start();
            }
        }
        else {
            this.player.animations.play(this.player.body.velocity.y < 0 ? "jump" : "shoot");
        }
        if (this.playElapsedSeconds() > this.nextCloud) {
            this.nextCloud += Phaser.Math.random(1, 4);
            var cloudX = game.world.width + 32;
            var cloudY = Phaser.Math.random(0, game.height - 128);
            this.createBackground(cloudX, cloudY, "clouds", obstaclesVelocity / 2);
        }
        if (this.playElapsedSeconds() > this.nextObstacle) {
            this.nextObstacle += Phaser.Math.random(0.8, 2.2);
            var obstacle = this.createObstacle(64, "obstacle");
            this.obstacles.push(obstacle);
        }
        if (this.playElapsedSeconds() > this.nextTarget) {
            this.nextTarget += Phaser.Math.random(0.3, 1.7);
            var target = this.createObstacle(Math.random() < 0.5 ? 96 : 128, "target");
            this.targets.push(target);
        }
        var score = Math.round(this.playElapsedSeconds() * 10) + this.scoreTargets * 5;
        this.scoreTextCurrent.text = score.toString();
        this.updateBackground();
        this.updateObstacles(score);
        this.updateTargetsAndBullets();
    };
    ;
    State.prototype.playElapsedSeconds = function () {
        return game.time.totalElapsedSeconds() - this.pauseElapsedSeconds;
    };
    State.prototype.createObstacle = function (height, sprite) {
        var x = game.world.width + 32;
        var y = game.world.height - height;
        var obstacle = this.groupForeground.create(x, y, sprite);
        game.physics.arcade.enable(obstacle);
        obstacle.body.velocity.x = -obstaclesVelocity;
        this.background.push(obstacle);
        return obstacle;
    };
    State.prototype.createBullet = function () {
        var player = this.player;
        var position = player.position;
        if (position.y >= game.world.height - player.height - 32)
            return;
        var x = position.x + player.width / 2;
        var y = position.y + player.height / 2;
        var bullet = this.groupForeground.create(x, y, "bullet");
        game.physics.arcade.enable(bullet);
        bullet.body.velocity.x = 600;
        this.bullets.push(bullet);
    };
    State.prototype.updateBackground = function () {
        for (var i = 0; i < this.background.length; i++) {
            var item = this.background[i];
            if (item.position.x < -item.width) {
                this.background.splice(i, 1);
                this.remove(this.obstacles, item);
                this.remove(this.targets, item);
                item.destroy();
            }
        }
    };
    State.prototype.remove = function (array, sprite) {
        var index = array.indexOf(sprite, 0);
        if (index > -1) {
            array.splice(index, 1);
        }
    };
    State.prototype.updateObstacles = function (score) {
        for (var i = 0; i < this.obstacles.length; i++) {
            var obstacle = this.obstacles[i];
            var hitObstacle = game.physics.arcade.collide(this.player, obstacle);
            if (hitObstacle) {
                var x = game.width / 2;
                var y = game.height / 2;
                var style = {
                    boundsAlignH: "center",
                    boundsAlignV: "middle",
                    fill: "#76e176",
                    fontSize: 16
                };
                var text = game.add.text(0, 0, "", style);
                text.textBounds = new Phaser.Rectangle(0, 0, x, game.height);
                text.text = "GAME OVER";
                var button = game.add.button(x * 1.5, y, "restart", this.restart, this);
                button.position.add(-button.width / 2, -button.height / 2);
                if (score > this.scoreHighest) {
                    this.scoreHighest = score;
                    this.scoreTextHighest.text = score.toString();
                    this.scoreTextHighest.visible = true;
                    localStorage.setItem(keyHighscore, score.toString());
                }
                game.physics.arcade.game.paused = true;
            }
        }
    };
    State.prototype.restart = function () {
        for (var i = 0; i < this.background.length; i++) {
            this.background[i].events.destroy();
        }
        game.paused = false;
        game.state.restart(true, false, this.scoreHighest);
        game.time.reset();
    };
    State.prototype.updateTargetsAndBullets = function () {
        for (var iT = 0; iT < this.targets.length; iT++) {
            var target = this.targets[iT];
            var hitPlayer = this.player.position.distance(target.position) < target.width;
            if (hitPlayer) {
                this.targets.splice(iT, 1);
                this.remove(this.background, target);
                target.destroy();
                this.scoreTargets++;
                continue;
            }
            for (var iB = 0; iB < this.bullets.length; iB++) {
                var bullet = this.bullets[iB];
                if (bullet.position.x > game.width + bullet.width) {
                    this.bullets.splice(iB, 1);
                    continue;
                }
                if (!game.physics.arcade.collide(target, bullet))
                    continue;
                this.targets.splice(iT, 1);
                this.bullets.splice(iB, 1);
                this.remove(this.background, target);
                target.destroy();
                bullet.destroy();
                this.scoreTargets++;
            }
        }
    };
    return State;
}());



window.onload = function () {
    var game = new Game();
    document.getElementById("buttonz").style.display="none";
};
