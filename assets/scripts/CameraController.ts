import { _decorator, Component, Node, Vec3, math, CCFloat } from "cc";
const { ccclass, property } = _decorator;

@ccclass("CameraController")
export class CameraController extends Component {
  @property({ type: Node, tooltip: "Tham chiếu đến Node Player" })
  public target: Node = null!;
  @property({
    type: CCFloat,
    range: [0.01, 1],
    slide: true,
    tooltip: "Tỉ lệ độ mượt khi theo sát mục tiêu (0.01-1)",
  })
  public smoothFactor: number = 0.05;
  @property(Vec3)
  public offset: Vec3 = new Vec3(0, 2, 0);
  private readonly fixedZ: number = 1000;
  private tempPosition: Vec3 = new Vec3();
  protected lateUpdate(dt: number): void {
    if (!this.target) {
      return;
    }
    const targetPos = this.target.getPosition();
    const currentCameraPos = this.node.getPosition();
    const targetX = targetPos.x + this.offset.x;
    const targetY = targetPos.y + this.offset.y;
    this.tempPosition.x = math.lerp(
      currentCameraPos.x,
      targetX,
      this.smoothFactor
    );
    this.tempPosition.y = math.lerp(
      currentCameraPos.y,
      targetY,
      this.smoothFactor
    );
    this.tempPosition.z = this.fixedZ;
    this.node.setPosition(this.tempPosition);
  }
}
