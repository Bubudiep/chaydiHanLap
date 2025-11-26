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
  private _worldCenter: Vec2 = new Vec2();
  private isRunning: boolean = true;
  private rigidBody: RigidBody2D = null!;
  private groundcheckColliderTag: Number = 9;
  private groundcheckCollider: Collider2D = null;
  private playerColliders: Collider2D[] = [];
  private groundContactColliders: Set<Collider2D> = new Set();
  public get isOnGround(): boolean {
    return this.groundContactColliders.size > 0;
  }
  onLoad() {
    this.rigidBody = this.node.getComponent(RigidBody2D)!;
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    this.playerColliders = this.node.getComponents(Collider2D);
    this.groundcheckCollider = this.playerColliders.find(
      (colider) => colider.tag === this.groundcheckColliderTag
    );
    if (this.playerColliders.length > 0) {
      this.playerColliders.forEach((collider) => {
        collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
      });
    }
  }

  onDestroy() {
    // Dọn dẹp lắng nghe để tránh rò rỉ bộ nhớ
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    if (this.groundcheckCollider) {
      this.groundcheckCollider.off(
        Contact2DType.BEGIN_CONTACT,
        this.onBeginContact,
        this
      );
      this.groundcheckCollider.off(
        Contact2DType.END_CONTACT,
        this.onEndContact,
        this
      );
    }
  }
  update(deltaTime: number) {
    this.autoRun(deltaTime);
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
        this.currentSpeed + this.accelerationRate * dt, // Tốc độ tăng dần
        this.moveSpeed // Giới hạn ở tốc độ tối đa
      );
    }
    const velocity = this.rigidBody.linearVelocity;
    velocity.x = this.currentSpeed;
    this.rigidBody.linearVelocity = velocity;
  }
  public stop() {
    // 1. Lưu lại các giá trị tốc độ game
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
      this.jump();
    }
  }
  private jump() {
    if (!this.isRunning || !this.isOnGround || !this.rigidBody) {
      return;
    }
    this.rigidBody.applyLinearImpulseToCenter(
      new Vec2(0, this.jumpForce),
      true
    );
  }
  private onBeginContact(
    selfCollider: Collider2D,
    otherCollider: Collider2D,
    contact: IPhysics2DContact | null
  ) {
    if (otherCollider.tag === 9) {
      this.groundContactColliders.add(otherCollider);
    }
  }
  private onEndContact(
    selfCollider: Collider2D,
    otherCollider: Collider2D,
    contact: IPhysics2DContact | null
  ) {
    // Kiểm tra tag và xóa khỏi Set nếu đúng
    if (otherCollider.tag === 9) {
      this.groundContactColliders.delete(otherCollider);
    }
  }
}
