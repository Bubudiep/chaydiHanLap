import {
  _decorator,
  Component,
  Node,
  CCFloat,
  Label,
  resources,
  director,
} from "cc";

import { PlayerController } from "./PlayerController";
import { GroundManager } from "./GroundManager"; // Import GroundManager mới
import { ModalManager } from "./Modal/ModalManager";

const { ccclass, property } = _decorator;

@ccclass("GameManager")
export class GameManager extends Component {
  @property({
    type: CCFloat,
    tooltip: "Tọa độ Y tối thiểu của Player. Nếu thấp hơn, Game Over.",
  })
  public fallLimitY: number = -700; // Đặt ngưỡng ngã xuống
  @property({ type: Node, tooltip: "Node gốc của Player" })
  public playerNode: Node = null!;
  @property({ type: PlayerController, tooltip: "Script PlayerController" })
  public playerController: PlayerController = null!;
  private groundManager: GroundManager = null!;
  @property({
    type: CCFloat,
    tooltip: "Tốc độ game (tốc độ Player/tốc độ di chuyển Ground)",
  })
  public gameSpeed: number = 10;
  @property({ type: Label, tooltip: "Label hiển thị quãng đường đã chạy" })
  public distanceLabel: Label = null!;
  @property({
    type: ModalManager,
    tooltip: "Script quản lý Modal (Popup)",
  })
  public modalManager: ModalManager = null!;
  private score: number = 0;
  private totalDistance: number = 0;
  private isGameRunning: boolean = false;
  private distanceUpdateTimer: number = 0;
  private readonly UPDATE_INTERVAL: number = 0.5;
  private initialPlayerX: number = 0;
  private readonly SPEED_LEVELS = [
    {
      distance: 0,
      speed: 10,
      minRandomY: -40,
      maxRandomY: 40,
      minXrandom: 140,
      maxXrandom: 180,
    }, // Mốc 0
    {
      distance: 50,
      speed: 15,
      minRandomY: -50,
      maxRandomY: 50,
      minXrandom: 160,
      maxXrandom: 240,
    }, // Mốc 1
    {
      distance: 100,
      speed: 20,
      minRandomY: -40,
      maxRandomY: 60,
      minXrandom: 200,
      maxXrandom: 300,
    }, // Mốc 2
    {
      distance: 200,
      speed: 25,
      minRandomY: -30,
      maxRandomY: 80,
      minXrandom: 220,
      maxXrandom: 380,
    }, // Mốc 3
    {
      distance: 350,
      speed: 32,
      minRandomY: -20,
      maxRandomY: 90,
      minXrandom: 240,
      maxXrandom: 450,
    }, // Mốc 4
    {
      distance: 500,
      speed: 40,
      minRandomY: -30,
      maxRandomY: 100,
      minXrandom: 280,
      maxXrandom: 550,
    }, // Mốc 5
  ];
  private currentSpeedLevel: number = 0;
  onLoad() {
    if (this.playerController) {
      this.playerController.moveSpeed = this.gameSpeed;
      this.playerController.accelerationRate = this.gameSpeed * 2;
    }
    const gmComponent = this.node.getComponent(GroundManager);
    if (gmComponent) {
      this.groundManager = gmComponent;
      this.groundManager.onLoadedCallback = this.startGame.bind(this);
      if (!this.groundManager.IsLoading) {
        this.startGame();
      }
    } else {
      console.error("LỖI: Không tìm thấy GroundManager trên Node này!");
    }
  }

  update(deltaTime: number) {
    if (this.groundManager.IsLoading) return;
    if (!this.isGameRunning) return;
    this.updateScore(deltaTime);
    this.updateDistance(deltaTime);
    this.checkFallLimit();
    if (this.playerNode) {
      this.groundManager.checkAndRecycleGround(this.playerNode.position.x);
    }
    this.checkGameSpeed();
  }
  private checkFallLimit() {
    if (!this.playerNode) return;
    const playerY = this.playerNode.position.y;
    if (playerY < this.fallLimitY) {
      this.gameOver();
    }
  }
  private startGame() {
    if (this.groundManager.IsLoading) {
      console.log("GroundManager đang tải, chưa thể bắt đầu game.");
      if (this.groundManager.groundPrefabPaths.length === 0) {
        this.finishGameStart();
      }
      return;
    }
    this.finishGameStart();
  }
  private finishGameStart() {
    this.isGameRunning = true;
    this.score = 0;
    this.totalDistance = 0;
    this.distanceUpdateTimer = 0;
    this.currentSpeedLevel = 0;
    if (this.distanceLabel) {
      this.distanceLabel.string = `0M`;
    }
    if (this.playerNode) {
      this.initialPlayerX = this.playerNode.position.x;
    }
  }
  private updateDistanceLabel() {
    if (this.distanceLabel) {
      const tometer = this.totalDistance / 150;
      this.distanceLabel.string = `${tometer.toFixed(0)}M`;
    }
  }
  private checkGameSpeed() {
    const currentDistanceMeters = this.totalDistance / 150;
    const nextLevelIndex = this.currentSpeedLevel;
    const nextLevel = this.SPEED_LEVELS[nextLevelIndex];
    if (nextLevel) {
      if (currentDistanceMeters >= nextLevel.distance) {
        const newSpeed = nextLevel.speed;
        console.log(
          `Đã đạt mốc ${nextLevel.distance}M! Tăng tốc độ game lên ${newSpeed}!`
        );
        this.gameSpeed = newSpeed;
        this.currentSpeedLevel++;
        if (this.playerController) {
          this.playerController.moveSpeed = this.gameSpeed;
        }
        if (this.groundManager) {
          this.groundManager.minRandomX = nextLevel.minXrandom;
          this.groundManager.maxRandomX = nextLevel.maxXrandom;
        }
      }
    }
    if (this.playerController) {
      this.playerController.moveSpeed = this.gameSpeed;
    }
  }
  private updateDistance(deltaTime: number) {
    if (!this.playerNode) return;
    this.totalDistance = this.playerNode.position.x - this.initialPlayerX;
    this.distanceUpdateTimer += deltaTime;
    if (this.distanceUpdateTimer >= this.UPDATE_INTERVAL) {
      this.updateDistanceLabel();
      this.distanceUpdateTimer -= this.UPDATE_INTERVAL;
    }
  }
  private updateScore(dt: number) {
    this.score += this.gameSpeed * dt * 0.1;
  }
  public pauseGame() {
    if (this.isGameRunning) {
      this.isGameRunning = false;
      if (this.playerController) {
        this.playerController.stop();
      }
    }
  }
  public resumeGame() {
    if (!this.isGameRunning) {
      this.isGameRunning = true;
      console.log("Game Đã Tiếp Tục.");
      // Lấy tốc độ game đã được tính toán (đã tính mốc tăng tốc)
      const currentSpeed = this.SPEED_LEVELS[this.currentSpeedLevel].speed;
      const currentAcceleration = currentSpeed * 2.5;
      if (this.playerController) {
        this.playerController.resume(currentSpeed, currentAcceleration);
      }
    }
  }
  public gameOver() {
    this.pauseGame();
    if (this.modalManager) this.modalManager.showGameOverPopup();
  }
  public onGroundsLoaded() {
    this.finishGameStart();
  }
  public restartGame() {
    this.pauseGame();
    const currentSceneName = director.getScene().name;
    director.loadScene(currentSceneName, () => {
      console.log(`Scene ${currentSceneName} đã được tải lại.`);
    });
  }
}
