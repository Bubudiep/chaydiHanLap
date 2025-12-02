import {
  _decorator,
  Component,
  Node,
  Vec3,
  RigidBody2D,
  Vec2,
  input,
  Input,
  Contact2DType,
  IPhysics2DContact,
  KeyCode,
  EventKeyboard,
  Collider2D,
  CCFloat,
  animation,
  ERigidBody2DType, // Thêm RigidBodyType
  // Cần thêm các import liên quan đến vật lý 2D
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("PlayerController")
export class PlayerController extends Component {
  private _savedBodyType: ERigidBody2DType = ERigidBody2DType.Dynamic;
  private _savedVelocity: Vec2 = new Vec2(); // Biến mới để lưu vận tốc
  private _originalMoveSpeed: number = 0;
  private _originalAccelerationRate: number = 0;
  @property({
    type: CCFloat,
    tooltip: "Tốc độ di chuyển ngang tối đa (đơn vị/giây)",
  })
  public moveSpeed: number = 5;
  @property({
    type: CCFloat,
    tooltip: "Tốc độ tăng tốc ban đầu (đơn vị/giây^2)",
  })
  public accelerationRate: number = 3;
  private currentSpeed: number = 0; // Tốc độ hiện tại (bắt đầu từ 0)
  @property({
    type: CCFloat,
    tooltip: "Lực tác động khi nhảy (nên là giá trị lớn, 200-500)",
  })
  public jumpForce: number = 300;
  @property({
    type: CCFloat,
    tooltip: "Lực tác động ngược chiều khi Wall Jump",
  })
  public wallJumpXForce: number = 300; // Lực đẩy ngược chiều X
  private wallcheckColliderTag: Number = 8; // Tag cho vật cản (Tường)
  private wallContactColliders: Set<Collider2D> = new Set();
  private _worldCenter: Vec2 = new Vec2();
  private isRunning: boolean = true;
  private rigidBody: RigidBody2D = null!;
  private playerColliders: Collider2D[] = [];
  private groundContactColliders: Set<Collider2D> = new Set();
  public get isOnGround(): boolean {
    return this.groundContactColliders.size > 0;
  }
  public get isOnWall(): boolean {
    return this.wallContactColliders.size > 0;
  }
  public get isFalling(): boolean {
    if (!this.rigidBody) return false;
    return this.rigidBody.linearVelocity.y < -0.1;
  }
  private isMovingLeft: boolean = false;
  private isMovingRight: boolean = false;
  private animController: animation.AnimationController = null!;
  onLoad() {
    this.rigidBody = this.node.getComponent(RigidBody2D)!;
    this.playerColliders = this.node.getComponents(Collider2D);
    this.animController = this.node.getComponent(
      animation.AnimationController
    )!;
    if (!this.animController) {
      console.error("AnimationController component not found!");
    }
    if (this.playerColliders.length > 0) {
      this.playerColliders
        .filter((c) => [9, 8].indexOf(c.tag) !== -1)
        .forEach((collider) => {
          collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
          collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        });
    }
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    this.playerColliders
      .filter((c) => [9, 8].indexOf(c.tag) !== -1)
      .forEach((collider) => {
        collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
      });
  }
  update(deltaTime: number) {
    // this.autoRun(deltaTime);
    this.handleMovement(deltaTime);
    this.updateAnimationParameters();
  }
  private updateAnimationParameters() {
    if (!this.animController || !this.rigidBody) return;
    this.animController.setValue("falling", this.isFalling);
    this.animController.setValue("grounded", this.isOnGround);
  }
  public handleMovement(dt: number): void {
    if (!this.rigidBody) return;
    let targetSpeed = 0;
    let direction = 0;
    if (this.isMovingRight) {
      direction = 1;
    } else if (this.isMovingLeft) {
      direction = -1;
    }
    if (direction !== 0) {
      this.currentSpeed = Math.min(
        this.currentSpeed + this.accelerationRate * dt,
        this.moveSpeed
      );
      targetSpeed = direction * this.currentSpeed;
    } else {
      this.currentSpeed = Math.max(
        this.currentSpeed - this.accelerationRate * dt * 2, // Giảm tốc nhanh hơn
        0
      );
      targetSpeed =
        this.currentSpeed * Math.sign(this.rigidBody.linearVelocity.x);
      if (this.currentSpeed === 0) {
        targetSpeed = 0;
      }
    }
    if (targetSpeed > 0) {
      this.node.setScale(1, this.node.scale.y, this.node.scale.z);
    } else if (targetSpeed < 0) {
      this.node.setScale(-1, this.node.scale.y, this.node.scale.z);
    }
    const velocity = this.rigidBody.linearVelocity;
    this.animController.setValue("speed", targetSpeed);
    velocity.x = targetSpeed;
    this.rigidBody.linearVelocity = velocity;
  }
  public autoRun(dt: number): void {
    if (!this.isRunning || !this.rigidBody || this.moveSpeed === 0) {
      if (this.rigidBody) {
        const velocity = this.rigidBody.linearVelocity;
        velocity.x = 0;
        this.rigidBody.linearVelocity = velocity;
      }
      return;
    }
    if (this.currentSpeed < this.moveSpeed) {
      this.currentSpeed = Math.min(
        this.currentSpeed + this.accelerationRate * dt,
        this.moveSpeed
      );
    }
    const velocity = this.rigidBody.linearVelocity;
    velocity.x = this.currentSpeed;
    this.rigidBody.linearVelocity = velocity;
  }
  public stop() {
    this._originalMoveSpeed = this.moveSpeed;
    this._originalAccelerationRate = this.accelerationRate;
    this.isRunning = false;
    this.moveSpeed = 0;
    this.currentSpeed = 0;
    if (this.rigidBody) {
      this._savedVelocity.set(this.rigidBody.linearVelocity);
      this.rigidBody.linearVelocity = new Vec2(0, 0);
      this._savedBodyType = this.rigidBody.type;
      this.rigidBody.type = ERigidBody2DType.Kinematic;
    }
  }
  public resume(newSpeed: number, newAccelerationRate: number) {
    this.isRunning = true;
    this.moveSpeed = newSpeed;
    this.accelerationRate = newAccelerationRate;
    this.currentSpeed = 0;
    this.rigidBody.type = this._savedBodyType;
    if (this.rigidBody) {
      const restoredVelocity = new Vec2(newSpeed, this._savedVelocity.y);
      this.rigidBody.linearVelocity = restoredVelocity;
    }
  }
  private onKeyDown(event: EventKeyboard) {
    if (event.keyCode === KeyCode.SPACE) {
      this.animController.setValue("startjump", true);
      this.jump();
    }
    if (event.keyCode === KeyCode.KEY_A) {
      this.isMovingLeft = true;
    } else if (event.keyCode === KeyCode.KEY_D) {
      this.isMovingRight = true;
    }
  }
  private onKeyUp(event: EventKeyboard) {
    if (event.keyCode === KeyCode.SPACE) {
      this.animController.setValue("startjump", false);
    }
    if (event.keyCode === KeyCode.KEY_A) {
      this.isMovingLeft = false;
    } else if (event.keyCode === KeyCode.KEY_D) {
      this.isMovingRight = false;
    }
    if (!this.isMovingLeft && !this.isMovingRight && !this.isRunning) {
      this.currentSpeed = 0; // Đặt tốc độ hiện tại về 0 khi dừng
    }
  }
  // private jump() {
  //   if (this.isOnGround) {
  //     this.rigidBody.applyLinearImpulseToCenter(
  //       new Vec2(0, this.jumpForce),
  //       true
  //     );
  //   } else {
  //     console.log(this.groundContactColliders.size);
  //   }
  // }
  private jump_btn() {
    this.animController.setValue("startjump", true);
    this.jump();
    setTimeout(() => this.animController.setValue("startjump", false), 500);
  }
  private jump() {
    if (this.isOnGround) {
      this.rigidBody.applyLinearImpulseToCenter(
        new Vec2(0, this.jumpForce),
        true
      );
    }
  }
  private onBeginContact(
    selfCollider: Collider2D,
    otherCollider: Collider2D,
    contact: IPhysics2DContact | null
  ) {
    if (otherCollider.tag === 9 && selfCollider.tag === 9) {
      this.groundContactColliders.add(otherCollider);
      if (this.rigidBody) {
        const velocity = this.rigidBody.linearVelocity;
        if (velocity.y < 0) {
          velocity.y = 0;
          this.rigidBody.linearVelocity = velocity;
        }
      }
    }
    if (
      selfCollider.tag === 99 &&
      otherCollider.tag === this.wallcheckColliderTag
    ) {
      this.wallContactColliders.add(otherCollider);
    }
  }
  private onEndContact(
    selfCollider: Collider2D,
    otherCollider: Collider2D,
    contact: IPhysics2DContact | null
  ) {
    if (otherCollider.tag === 9) {
      this.groundContactColliders.delete(otherCollider);
    }
    if (
      selfCollider.tag === 99 &&
      otherCollider.tag === this.wallcheckColliderTag
    ) {
      this.wallContactColliders.delete(otherCollider);
    }
  }
}
