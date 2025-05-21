import * as THREE from 'three';
import { FACTION, EVENT } from "../utils.js";
import { Game } from './Game.js';

/**
 * Cần sửa việc xử lý các state phụ thuộc frame thành phụ thuộc thời gian sau khi tách việc cập nhật mỗi Logic mỗi frame
 * Cần thêm các phương thức detect vật thể xung quanh -> Tạo đồ thị các điểm khả thi để di chuyển -> A* / Disjktra -> chase/attack/retreat
 * Boid, Ant colony nếu khả thi
 */


const State = Object.freeze({
    IDLE: 'idle',         // Nghỉ - xoay, quan sát ngẫu nhiên xung quanh
    PATROL: 'patrol',     // Tuần tra - đi xung quanh khu vực nhất định
    CHASE: 'chase',       // Đuổi theo target
    ATTACK: 'attack',     // Tấn công
    RETREAT: 'retreat'    // Rút lui
});

class Bot {
    static instance;
    tanks = [];

    constructor() {
        if (Bot.instance) {
            return Bot.instance;
        }
        Bot.instance = this;
    }

    addTank(tank) {
        tank.bot = {
            currentState: State.IDLE,
            playerTank: Game.instance.playerTank, // Mục tiêu

            detectionRange: 300,      // Phạm vi phát hiện
            attackRange: 50,         // Phạm vi tấn công
            safeRange: 7,            // Khoảng cách an toàn
            patrolPoints: this.generatePatrolPoints(tank.position), // Các điểm tuần tra
            currentPatrolIndex: 0,
            patrolWaitTime: 0,
            maxPatrolWait: 60,       // Thời gian chờ tại mỗi điểm tuần tra (frames)
            lastStateChangeTime: 0,  // Thời gian thay đổi trạng thái gần nhất
            minStateTime: 60,        // Thời gian tối thiểu để giữ một trạng thái (frames)
            frameCount: 0,           // Đếm frame
            retreatThreshold: 0,    // HP dưới mức này sẽ rút lui
            retreatTime: 180,        // Thời gian rút lui trước khi đánh giá lại (frames)
            retreatStartTime: 0,     // Thời điểm bắt đầu rút lui

            // Góc quay ngẫu nhiên khi IDLE
            idleRotationDir: Math.random() > 0.5 ? 1 : -1,
            idleRotationTimer: 0,
            idleRotationDuration: 60 + Math.random() * 60,
        };

        this.tanks.push(tank);
    }

    /**
     * @param {Object} position - Vị trí ban đầu
     * @returns {Array} - Danh sách các điểm tuần tra
     */
    generatePatrolPoints(position) {
        const points = [];
        const radius = 150;

        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = radius * (0.3 + Math.random() * 0.7);
            const x = position.x + Math.cos(angle) * distance;
            const z = position.z + Math.sin(angle) * distance;
            points.push(new THREE.Vector3(x, 1, z));
        }

        return points;
    }

    removeTank(tank) {
        const index = this.tanks.findIndex(t => t === tank);
        if (index !== -1) {
            this.tanks.splice(index, 1);
        }
    }

    update() {
        for (const tank of this.tanks) {
            this.updateTankBehavior(tank);
        }
    }

    updateTankBehavior(tank) {
        const bot = tank.bot;
        bot.frameCount++;
        
        // Player chết -> PATROL
        if (!bot.playerTank || bot.playerTank.hp <= 0) {
            this.transitionTo(tank, State.PATROL);
            this.executeCurrentState(tank);
            return;
        }

        const distanceToPlayer = tank.position.distanceTo(bot.playerTank.position);

        // Điều kiện chuyển trạng thái
        if (bot.frameCount - bot.lastStateChangeTime > bot.minStateTime) {
            // HP thấp -> RETREAT
            if (tank.hp < bot.retreatThreshold && bot.currentState !== State.RETREAT) {
                this.transitionTo(tank, State.RETREAT);
                bot.retreatStartTime = bot.frameCount;
            }
            // Nếu đang RETREAT, kiểm tra thời gian rút lui
            else if (bot.currentState === State.RETREAT &&
                (bot.frameCount - bot.retreatStartTime > bot.retreatTime)) {
                // Sau khi rút lui, nếu HP vẫn thấp, tiếp tục rút lui
                if (tank.hp < bot.retreatThreshold) {
                    bot.retreatStartTime = bot.frameCount;
                } else {
                    this.transitionTo(tank, State.PATROL); // HP hồi phục -> PATROL
                }
            }
            // Phát hiện player và trong tầm tấn công -> ATTACK
            else if (distanceToPlayer <= bot.attackRange && bot.currentState !== State.ATTACK) {
                this.transitionTo(tank, State.ATTACK);
            }
            // Phát hiện player nhưng ngoài tầm -> CHASE
            else if (distanceToPlayer <= bot.detectionRange &&
                distanceToPlayer > bot.attackRange &&
                bot.currentState !== State.CHASE) {
                this.transitionTo(tank, State.CHASE);
            }
            // Ngoài tầm phát hiện -> PATROL
            else if (distanceToPlayer > bot.detectionRange &&
                bot.currentState !== State.PATROL &&
                bot.currentState !== State.RETREAT) {
                this.transitionTo(tank, State.PATROL);
            }
        }

        this.executeCurrentState(tank);
    }

    /**
     * @param {Tank} tank - Tank cần thay đổi trạng thái
     * @param {String} newState - Trạng thái mới
     */
    transitionTo(tank, newState) {
        const bot = tank.bot;
        if (newState !== bot.currentState) {
            // console.log(`Tank ${tank.id} changing state: ${bot.currentState} -> ${newState}`);
            bot.currentState = newState;
            bot.lastStateChangeTime = bot.frameCount;

            // Xử lý khi vào trạng thái mới
            switch (newState) {
                case State.PATROL:
                    // Reset index tuần tra khi chuyển sang PATROL
                    bot.currentPatrolIndex = this.findClosestPatrolPoint(tank);
                    bot.patrolWaitTime = 0;
                    break;
                case State.ATTACK:
                    // Bắt đầu bắn tự động khi vào trạng thái ATTACK
                    tank.startAutoShoot(1000);
                    break;
                default:
                    // Dừng bắn khi không ở trạng thái ATTACK
                    tank.stopAutoShoot();
                    break;
            }
        }
    }

    /**
     * @param {Tank} tank - Tank cần tìm điểm tuần tra
     * @returns {Number} - Index của điểm tuần tra gần nhất
     */
    findClosestPatrolPoint(tank) {
        const bot = tank.bot;
        let closestIndex = 0;
        let closestDistance = Infinity;

        for (let i = 0; i < bot.patrolPoints.length; i++) {
            const distance = tank.position.distanceTo(bot.patrolPoints[i]);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    /**
     * @param {Tank} tank - Tank cần xử lý
     */
    executeCurrentState(tank) {
        const bot = tank.bot;
        switch (bot.currentState) {
            case State.IDLE:
                this.executeIdleState(tank);
                break;
            case State.PATROL:
                this.executePatrolState(tank);
                break;
            case State.CHASE:
                this.executeChaseState(tank);
                break;
            case State.ATTACK:
                this.executeAttackState(tank);
                break;
            case State.RETREAT:
                this.executeRetreatState(tank);
                break;
        }
    }

    /**
     * @param {Tank} tank - Tank cần xử lý
     */
    executeIdleState(tank) {
        const bot = tank.bot;
        bot.idleRotationTimer++;

        if (bot.idleRotationTimer <= bot.idleRotationDuration) {
            // Quay ngẫu nhiên trong thời gian ngắn
            if (bot.idleRotationDir > 0) {
                tank.rotateLeft(tank.rotateSpeed * 0.5);
            } else {
                tank.rotateRight(tank.rotateSpeed * 0.5);
            }
        } else {
            // Đổi hướng quay sau khi hoàn thành
            bot.idleRotationDir *= -1;
            bot.idleRotationTimer = 0;
            bot.idleRotationDuration = 60 + Math.random() * 60;
        }
    }

    /**
     * @param {Tank} tank - Tank cần xử lý
     */
    executePatrolState(tank) {
        const bot = tank.bot;
        const targetPoint = bot.patrolPoints[bot.currentPatrolIndex];
        const distanceToTarget = tank.position.distanceTo(targetPoint);
        if (distanceToTarget < 1) {
            // Đã đến điểm tuần tra, chờ một thời gian rồi chuyển điểm
            bot.patrolWaitTime++;

            if (bot.patrolWaitTime >= bot.maxPatrolWait) {
                // Chuyển sang điểm tuần tra tiếp theo
                bot.currentPatrolIndex = (bot.currentPatrolIndex + 1) % bot.patrolPoints.length;
                bot.patrolWaitTime = 0;
            } else {
                tank.rotateLeft(tank.rotateSpeed * 0.5);
            }
        } else {
            this.moveTowardTarget(tank, targetPoint);
        }
    }

    /**
     * @param {Tank} tank - Tank cần xử lý
     */
    executeChaseState(tank) {
        const bot = tank.bot;
        this.moveTowardTarget(tank, bot.playerTank.position);
    }

    /**
     * @param {Tank} tank - Tank cần xử lý
     */
    executeAttackState(tank) {
        const bot = tank.bot;
        const distanceToPlayer = tank.position.distanceTo(bot.playerTank.position);

        if (distanceToPlayer < bot.safeRange) {
            this.moveAwayFromTarget(tank, bot.playerTank.position);
        }
        else if (distanceToPlayer > bot.attackRange * 0.8) {
            this.moveTowardTarget(tank, bot.playerTank.position);
        }
        else {
            this.faceTarget(tank, bot.playerTank.position);
            // 5% cơ hội di chuyển sang ngang để né đạn j4f
            // if (Math.random() < 0.05) {
            //     const moveDir = Math.random() > 0.5 ? 1 : -1;
            //     this.moveStrafe(tank, moveDir);
            // }
        }
    }

    /**
     * @param {Tank} tank - Tank cần xử lý
     */
    executeRetreatState(tank) {
        const bot = tank.bot;
        const distanceToPlayer = tank.position.distanceTo(bot.playerTank.position);

        // Nếu đã đủ xa -> IDLE
        if (distanceToPlayer > bot.detectionRange * 1.2) {
            this.transitionTo(tank, State.IDLE);
        } else {
            this.moveAwayFromTarget(tank, bot.playerTank.position);

            // 10% cơ hội bắn trả khi rút lui
            if (Math.random() < 0.01 && distanceToPlayer < bot.attackRange) {
                this.faceTarget(tank, bot.playerTank.position);
                tank.shoot();
            }
        }
    }

    /**
     * @param {Tank} tank - Tank cần di chuyển
     * @param {THREE.Vector3} targetPosition - Vị trí mục tiêu
     */
    moveTowardTarget(tank, targetPosition) {
        this.faceTarget(tank, targetPosition);
        tank.moveForward();
    }

    /**
     * @param {Tank} tank - Tank cần di chuyển
     * @param {THREE.Vector3} targetPosition - Vị trí mục tiêu
     */
    moveAwayFromTarget(tank, targetPosition) {
        this.faceTarget(tank, targetPosition);
        tank.moveBackward();
    }

    /**
     * @param {Tank} tank - Tank cần di chuyển
     * @param {Number} direction - Hướng di chuyển (1: phải, -1: trái)
     */
    moveStrafe(tank, direction) {
        // Xoay 90 độ để di chuyển sang ngang
        if (!tank.model) return;

        const currentRotation = tank.model.rotation.y;
        if (direction > 0) {
            tank.model.rotation.y = currentRotation + Math.PI / 2;
            tank.moveForward();
            tank.model.rotation.y = currentRotation;
        } else {
            tank.model.rotation.y = currentRotation - Math.PI / 2;
            tank.moveForward();
            tank.model.rotation.y = currentRotation;
        }
    }

    /**
     * @param {Tank} tank - Tank cần xoay
     * @param {THREE.Vector3} targetPosition - Vị trí mục tiêu
     */
    faceTarget(tank, targetPosition) {
        if (!tank.model) return;

        const targetDirection = new THREE.Vector3()
            .subVectors(targetPosition, tank.position)
            .normalize();

        // Tính góc để quay đến hướng mục tiêu
        const tankForward = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(tank.model.quaternion);

        // Tính dấu của góc (quay phải hoặc trái)
        const cross = new THREE.Vector3().crossVectors(tankForward, targetDirection);
        const dot = tankForward.dot(targetDirection);

        // Nếu chưa đối mặt với mục tiêu
        if (dot < 0.98) {
            if (cross.y > 0) {
                tank.rotateLeft();
            } else {
                tank.rotateRight();
            }
        }
    }

    clear() {
        this.tanks = [];
    }
}

export { Bot, State }; 