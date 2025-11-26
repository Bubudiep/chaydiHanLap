import {
  _decorator,
  Component,
  Node,
  CCFloat,
  Prefab,
  instantiate,
  Vec3,
  resources,
  CCString,
  UITransform,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("GroundManager")
export class GroundManager extends Component {
  @property({
    type: CCFloat,
    tooltip: "Phạm vi ngẫu nhiên TỐI THIỂU cho thay đổi Y",
  })
  public minRandomY: number = -60;
  @property({
    type: CCFloat,
    tooltip: "Phạm vi ngẫu nhiên TỐI ĐA cho thay đổi Y",
  })
  public maxRandomY: number = 60;
  @property({
    type: CCFloat,
    tooltip: "Phạm vi ngẫu nhiên TỐI THIỂU cho khoảng cách X",
  })
  public minRandomX: number = 70;
  @property({
    type: CCFloat,
    tooltip: "Phạm vi ngẫu nhiên TỐI ĐA cho khoảng cách X",
  })
  public maxRandomX: number = 200;
  @property({ type: Node, tooltip: "Node cha chứa tất cả các khối mặt đất" })
  public groundContainer: Node = null!;
  @property({ type: CCFloat, tooltip: "Số lượng khối đất khởi tạo ban đầu" })
  public initialGroundChunks: number = 5;
  @property({
    type: CCString,
    tooltip: "Đường dẫn của các Prefab Ground trong thư mục resources",
  })
  public groundPrefabPaths: string[] = [];
  private groundPrefabs: Prefab[] = [];
  private activeGrounds: Node[] = [];
  private lastGroundY: number = -330; // Biến theo dõi Y cuối cùng
  private groundLength: number = 700; // Chiều dài mặc định của Ground Chunk
  private isLoading: boolean = true; // Cờ kiểm soát trạng thái tải
  public onLoadedCallback: () => void = null!;
  onLoad() {
    this.loadGroundPrefabs();
  }
  public get IsLoading(): boolean {
    return this.isLoading;
  }
  private loadGroundPrefabs() {
    if (this.groundPrefabPaths.length === 0) {
      console.warn(
        "Không có đường dẫn Prefab nào được liệt kê. Khởi tạo ngay lập tức."
      );
      this.isLoading = false;
      this.initGround();
      return;
    }
    let loadedCount = 0;
    this.groundPrefabs = [];
    for (const path of this.groundPrefabPaths) {
      resources.load(path, Prefab, (err, prefab) => {
        if (err) {
          console.error(`Lỗi tải Prefab từ đường dẫn ${path}:`, err);
          return;
        }
        this.groundPrefabs.push(prefab);
        loadedCount++;
        if (loadedCount === this.groundPrefabPaths.length) {
          this.isLoading = false;
          this.initGround();
          console.log("Tải Ground Prefabs hoàn tất.");
          if (this.onLoadedCallback) {
            this.onLoadedCallback();
          }
        }
      });
    }
  }
  private getRandomGroundPrefab(): Prefab | null {
    if (this.groundPrefabs.length === 0) {
      console.error("Danh sách Ground Prefabs bị rỗng!");
      return null;
    }
    const randomIndex = Math.floor(Math.random() * this.groundPrefabs.length);
    return this.groundPrefabs[randomIndex];
  }
  private getGroundLength(prefab: Prefab): number {
    if (!prefab) return 0;
    // Khởi tạo tạm thời để lấy kích thước
    const tempNode = instantiate(prefab) as Node;
    const length = tempNode.getComponent(UITransform).contentSize.width;
    tempNode.destroy();
    return length;
  }

  /**
   * Khởi tạo các khối Ground ban đầu.
   */
  public initGround() {
    if (this.groundPrefabs.length === 0 || !this.groundContainer) {
      console.error("Thiếu Ground Prefabs hoặc Ground Container!");
      return;
    }
    this.activeGrounds.forEach((node) => node.destroy());
    this.activeGrounds = [];
    const START_X = 0;
    const START_Y = -330;
    this.lastGroundY = START_Y;
    let currentX = START_X;
    this.groundLength = this.getGroundLength(this.groundPrefabs[0]);
    if (this.groundLength === 0) {
      console.error("Không thể xác định groundLength. Dừng khởi tạo.");
      return;
    }
    for (let i = 0; i < this.initialGroundChunks; i++) {
      const groundPrefab = this.getRandomGroundPrefab();
      if (!groundPrefab) continue;
      const newGround = instantiate(groundPrefab) as Node;
      this.groundContainer.addChild(newGround);
      newGround.setPosition(new Vec3(currentX, this.lastGroundY, 0));
      this.activeGrounds.push(newGround);
      const gap = this.randomRange(this.minRandomX, this.maxRandomX);
      currentX += this.groundLength + gap;
      const yOffset = this.randomRange(this.minRandomY, this.maxRandomY);
      this.lastGroundY += yOffset;
    }
  }
  public checkAndRecycleGround(playerX: number) {
    if (this.activeGrounds.length === 0) return;
    const firstGround = this.activeGrounds[0];
    const firstGroundPos = firstGround.position;
    const nodelength = firstGround.getComponent(UITransform).contentSize.width;
    const groundEndX = firstGroundPos.x + nodelength * 2;
    if (playerX > groundEndX) {
      this.recycleGround(firstGround);
    }
  }
  private recycleGround(groundToRecycle: Node) {
    groundToRecycle.destroy();
    this.activeGrounds.shift();
    const lastGround = this.activeGrounds[this.activeGrounds.length - 1];
    if (!lastGround) return; // Bảo vệ
    const gap = this.randomRange(this.minRandomX, this.maxRandomX);
    const lastGroundWidth =
      lastGround.getComponent(UITransform).contentSize.width;
    const newX =
      lastGround.position.x + lastGroundWidth / 2 + gap + this.groundLength / 2;
    const yOffset = this.randomRange(this.minRandomY, this.maxRandomY);
    this.lastGroundY = Math.max(-500, this.lastGroundY + yOffset); // Giới hạn Y tối thiểu để Ground không đi quá thấp

    // 4. Sinh ra và thêm khối đất mới
    const newGroundPrefab = this.getRandomGroundPrefab();
    if (!newGroundPrefab) return;
    const newGround = instantiate(newGroundPrefab) as Node;
    this.groundContainer.addChild(newGround);
    newGround.setPosition(new Vec3(newX, this.lastGroundY, 0));
    this.activeGrounds.push(newGround);
  }
  private randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}
