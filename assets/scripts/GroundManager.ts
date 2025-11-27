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
  public minRandomY: number = -40;
  public maxRandomY: number = 40;
  public minRandomX: number = 140;
  public maxRandomX: number = 180;
  @property({ type: Node, tooltip: "Node cha chứa tất cả các khối mặt đất" })
  public groundContainer: Node = null!;
  @property({ type: CCFloat, tooltip: "Số lượng khối đất khởi tạo ban đầu" })
  public initialGroundChunks: number = 10;
  @property({
    type: CCString,
    tooltip: "Đường dẫn của các Prefab Ground trong thư mục resources",
  })
  public groundPrefabPaths: string[] = [];
  public minGroundYLimit: number = -500;
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
    this.groundContainer.removeAllChildren();
    this.activeGrounds.forEach((node) => node.destroy());
    this.activeGrounds = [];
    // Tọa độ Y giới hạn ban đầu (Nếu bạn dùng minGroundYLimit thì áp dụng ở đây)
    const START_X = 0;
    const START_Y = -330;
    this.lastGroundY = START_Y; // Có thể áp dụng Math.max(minGroundYLimit, START_Y) nếu cần
    let currentX = START_X;
    // Khối đất cuối cùng được tạo ra (ban đầu là null)
    let lastGroundNode: Node | null = null;
    for (let i = 0; i < this.initialGroundChunks; i++) {
      let groundPrefab = null;
      if (i == 0) {
        groundPrefab = this.groundPrefabs[0];
      } else {
        groundPrefab = this.getRandomGroundPrefab();
      }
      if (!groundPrefab) continue;
      const chunkLength = this.getGroundLength(groundPrefab);
      if (chunkLength === 0) {
        console.warn("Prefab có chiều dài bằng 0, bỏ qua.");
        continue;
      }
      const newGround = instantiate(groundPrefab) as Node;
      this.groundContainer.addChild(newGround);
      // 2. TÍNH VỊ TRÍ X MỚI DỰA TRÊN KHỐI TRƯỚC VÀ KHỐI HIỆN TẠI
      if (lastGroundNode) {
        const lastChunkLength =
          lastGroundNode.getComponent(UITransform)!.contentSize.width;
        const gap = this.randomRange(this.minRandomX, this.maxRandomX);
        // X MỚI = Vị trí cuối của khối trước + Khoảng cách + Vị trí đầu của khối hiện tại
        // (lastGroundNode.position.x + lastChunkLength / 2) là điểm cuối của khối trước
        // (chunkLength / 2) là điểm đầu của khối hiện tại (do anchor mặc định ở tâm)
        currentX =
          lastGroundNode.position.x +
          lastChunkLength / 2 +
          gap +
          chunkLength / 2;
      }
      const yOffset = this.randomRange(this.minRandomY, this.maxRandomY);
      this.lastGroundY += yOffset;
      newGround.setPosition(new Vec3(currentX, this.lastGroundY, 0));
      this.activeGrounds.push(newGround);
      lastGroundNode = newGround;
    }
  }
  public checkAndRecycleGround(playerX: number) {
    if (this.activeGrounds.length === 0) return;
    const firstGround = this.activeGrounds[0];
    const firstGroundPos = firstGround.position;
    const nodelength = firstGround.getComponent(UITransform)!.contentSize.width;
    const groundEndX = firstGroundPos.x + nodelength / 2;
    const recycleThreshold = groundEndX + 1000;
    if (playerX > recycleThreshold) {
      this.recycleGround(firstGround);
    }
  }
  private recycleGround(groundToRecycle: Node) {
    groundToRecycle.destroy();
    this.activeGrounds.shift();

    const lastGround = this.activeGrounds[this.activeGrounds.length - 1];
    if (!lastGround) return; // Bảo vệ

    // 2. Tính toán vị trí Y mới (Giữ nguyên logic giới hạn Y)
    const yOffset = this.randomRange(this.minRandomY, this.maxRandomY);
    this.lastGroundY += yOffset;
    this.lastGroundY = Math.max(this.minGroundYLimit, this.lastGroundY); // Dùng minGroundYLimit

    // 3. Sinh ra khối đất mới
    const newGroundPrefab = this.getRandomGroundPrefab();
    if (!newGroundPrefab) return;
    const newGround = instantiate(newGroundPrefab) as Node;
    this.groundContainer.addChild(newGround);
    this.activeGrounds.push(newGround); // Thêm vào danh sách trước khi tính X

    // 4. Lấy chiều rộng của cả hai khối
    const lastGroundWidth =
      lastGround.getComponent(UITransform)!.contentSize.width;
    const newGroundWidth =
      newGround.getComponent(UITransform)!.contentSize.width; // Lấy chiều rộng khối mới

    // 5. Tính toán vị trí X mới chính xác
    const gap = this.randomRange(this.minRandomX, this.maxRandomX);

    // newX = Vị trí giữa khối cuối + (Nửa chiều rộng khối cuối) + Khoảng cách + (Nửa chiều rộng khối mới)
    const newX =
      lastGround.position.x + lastGroundWidth / 2 + gap + newGroundWidth / 2;

    // 6. Áp dụng vị trí
    newGround.setPosition(new Vec3(newX, this.lastGroundY, 0));
  }
  private randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}
