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
  private groundcheckColliderTag: Number = 9;
  private groundcheckCollider: Collider2D = null;
  private playerColliders: Collider2D[] = [];
  private groundContactColliders: Set<Collider2D> = new Set();
  public get isOnGround(): boolean {
    return this.groundContactColliders.size > 0;
  }
  public get isOnWall(): boolean {
    return this.wallContactColliders.size > 0;
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
  // Trong PlayerController.ts

  private jump() {
    if (!this.isRunning || !this.rigidBody) {
      return;
    }
    // Kiểm tra: Đang chạm tường VÀ KHÔNG CHẠM đất
    if (this.isOnWall && !this.isOnGround) {
      // Xác định hướng nhảy ngược
      // Giả sử: Nhân vật luôn chạy về phía trước (X dương)
      // Nếu chạm tường, ta cần xác định tường đang ở bên trái hay bên phải.
      // Cách đơn giản nhất là dựa vào hướng va chạm.
      // Tuy nhiên, vì đây là endless runner và nhân vật luôn chạy phải,
      // Ta chỉ cần đẩy nhân vật ngược chiều X (sang trái).
      // Hoặc xác định hướng: Nếu velocity.x hiện tại dương, đẩy ngược (âm); nếu âm, đẩy ngược (dương).
      const currentVX = this.rigidBody.linearVelocity.x;
      const pushDirectionX = currentVX > 0 ? -1 : 1;
      // Áp dụng lực Wall Jump: Lực Y để nhảy lên, Lực X để đẩy ra
      this.rigidBody.applyLinearImpulseToCenter(
        new Vec2(
          this.wallJumpXForce * pushDirectionX, // Đẩy ngược chiều ngang
          this.jumpForce // Lực nhảy dọc
        ),
        true
      );
      // Quan trọng: Sau khi Wall Jump, loại bỏ trạng thái bám tường tạm thời (nếu cần)
      // và reset vận tốc X để bắt đầu tăng tốc lại từ 0 (giống như sau khi va chạm mạnh).
      this.currentSpeed = 0;
      return; // Dùng return để không thực hiện Double Jump/Regular Jump
    }

    // --- REGULAR JUMP LOGIC (Chỉ nhảy khi chạm đất) ---
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
    if (otherCollider.tag === 9) {
      this.groundContactColliders.add(otherCollider);
      if (this.rigidBody) {
        const velocity = this.rigidBody.linearVelocity;
        if (velocity.y < 0) {
          velocity.y = 0;
          this.rigidBody.linearVelocity = velocity;
        }
      }
    }
    if (otherCollider.tag === this.wallcheckColliderTag) {
      this.wallContactColliders.add(otherCollider);
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
    if (otherCollider.tag === this.wallcheckColliderTag) {
      this.wallContactColliders.delete(otherCollider);
    }
  }
}
