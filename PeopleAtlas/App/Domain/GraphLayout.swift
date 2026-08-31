import Foundation

enum GraphStyle: String, CaseIterable, Sendable { case ring, hierarchy, planet, nebula }
struct AtlasPoint: Equatable, Sendable { var x: Double; var y: Double; var z: Double = 0 }

enum GraphLayout {
    /// Strong family edges are visited first; inverses never double the proximity weight.
    static func orderedIDs(_ network: AtlasSnapshot) -> [UUID] {
        var adjacency: [UUID: [UUID: Double]] = [:]
        for relation in network.relations {
            adjacency[relation.sourceID, default: [:]][relation.targetID] = max(adjacency[relation.sourceID]?[relation.targetID] ?? 0, relation.kind.proximity)
        }
        let neighbors = adjacency.mapValues { edges in
            edges.sorted {
                $0.value == $1.value ? $0.key.uuidString < $1.key.uuidString : $0.value > $1.value
            }.map(\.key)
        }
        var visited = Set<UUID>(), result: [UUID] = []
        // An explicit stack preserves depth-first family ordering without exhausting the
        // call stack when an imported atlas contains a long chain of thousands of people.
        for person in network.people.sorted(by: { $0.id.uuidString < $1.id.uuidString }) {
            var stack = [person.id]
            while let id = stack.popLast() {
                guard visited.insert(id).inserted else { continue }
                result.append(id)
                stack.append(contentsOf: (neighbors[id] ?? []).reversed())
            }
        }
        return result
    }

    static func levels(_ network: AtlasSnapshot) -> [UUID: Int] {
        var adjacency: [UUID: [(UUID, Int)]] = [:]
        for edge in network.relations {
            adjacency[edge.sourceID, default: []].append((edge.targetID, -edge.kind.levelDelta))
        }
        var levels: [UUID: Int] = [:]
        for person in network.people where levels[person.id] == nil {
            guard !(adjacency[person.id] ?? []).isEmpty else { levels[person.id] = -1; continue }
            levels[person.id] = 0
            var queue = [person.id], index = 0
            while index < queue.count {
                let current = queue[index]; index += 1
                for (next, delta) in adjacency[current] ?? [] where levels[next] == nil {
                    levels[next] = (levels[current] ?? 0) + delta; queue.append(next)
                }
            }
            let minimum = queue.compactMap { levels[$0] }.min() ?? 0
            for id in queue { levels[id, default: 0] -= minimum }
        }
        return levels
    }

    static func positions(_ network: AtlasSnapshot, style: GraphStyle) -> [UUID: AtlasPoint] {
        let ids = orderedIDs(network), count = ids.count
        guard count > 1 else { return Dictionary(uniqueKeysWithValues: ids.map { ($0, AtlasPoint(x: 0, y: 0)) }) }
        if style == .hierarchy {
            let values = levels(network)
            let rows = Set(values.values).sorted(by: >)
            var result: [UUID: AtlasPoint] = [:]
            for (row, level) in rows.enumerated() {
                let members = ids.filter { values[$0] == level }
                for (column, id) in members.enumerated() {
                    result[id] = AtlasPoint(x: members.count == 1 ? 0 : -0.85 + 1.7 * Double(column + 1) / Double(members.count + 1), y: rows.count == 1 ? 0 : -0.75 + 1.5 * Double(row) / Double(rows.count - 1))
                }
            }
            return result
        }
        var points: [UUID: AtlasPoint] = [:]
        for (index, id) in ids.enumerated() {
            let t = Double(index), angle = t * 2 * .pi / Double(count)
            if style == .ring { points[id] = AtlasPoint(x: 0.8 * sin(angle), y: -0.8 * cos(angle)) }
            else if style == .planet {
                let y = 1 - 2 * (t + 0.5) / Double(count), radius = sqrt(1 - y * y), longitude = t * 2.399963
                points[id] = AtlasPoint(x: radius * cos(longitude), y: y, z: radius * sin(longitude))
            } else {
                // Uniform disk area avoids compressing dense atlases into an outer annulus.
                let radius = 0.85 * sqrt((t + 0.5) / Double(count))
                points[id] = AtlasPoint(x: radius * cos(t * 2.399963), y: radius * sin(t * 2.399963))
            }
        }
        guard style == .planet || style == .nebula else { return points }
        let family = network.pairs.filter { $0.kind.proximity > 1 }
        let spacing = minimumSpacing(count: count, style: style)
        // Springs have a rest length: family members should be close, not pulled into
        // the same point. A spatial grid separates nearby nodes without an all-pairs scan.
        // All work is bounded and runs only on data/style changes, never animation frames.
        for iteration in 0..<96 {
            for edge in family where iteration < 28 {
                guard var a = points[edge.sourceID], var b = points[edge.targetID] else { continue }
                let strength = edge.kind.proximity * 0.0015
                let distance = sqrt(pow(b.x - a.x, 2) + pow(b.y - a.y, 2) + pow(b.z - a.z, 2))
                let restLength = spacing * (edge.kind.isSpouse ? 1.2 : edge.kind.isSibling ? 1.5 : 1.8)
                guard distance > restLength else { continue }
                // Bound each pull relative to local density. Long edges must not drag
                // hundreds of nodes inward faster than their neighbors can separate.
                let factor = min(strength * (distance - restLength), spacing * 0.08) / distance
                let dx = (b.x - a.x) * factor, dy = (b.y - a.y) * factor, dz = (b.z - a.z) * factor
                a.x += dx; a.y += dy; a.z += dz; b.x -= dx; b.y -= dy; b.z -= dz
                points[edge.sourceID] = a; points[edge.targetID] = b
            }
            let overlap = separate(&points, ids: ids, spacing: spacing, spatial: style == .planet)
            for id in ids where style == .planet {
                guard var p = points[id] else { continue }
                let length = max(0.001, sqrt(p.x * p.x + p.y * p.y + p.z * p.z))
                p.x /= length; p.y /= length; p.z /= length; points[id] = p
            }
            if (family.isEmpty || iteration >= 28), overlap < spacing * 0.02 { break }
        }
        return points
    }

    /// Density-aware world-space clearance, not a guarantee that a 3D projection has
    /// no occlusion. Rotation and zoom still let users inspect front/back sphere nodes.
    static func minimumSpacing(count: Int, style: GraphStyle) -> Double {
        let count = Double(max(1, count))
        return style == .planet ? min(0.5, sqrt(4 * .pi / count) * 0.65)
            : min(0.24, sqrt(.pi * 0.85 * 0.85 / count) * 0.75)
    }

    private struct Cell: Hashable { let x: Int; let y: Int; let z: Int }
    private static func separate(_ points: inout [UUID: AtlasPoint], ids: [UUID], spacing: Double, spatial: Bool) -> Double {
        var maximumOverlap = 0.0
        var buckets: [Cell: [Int]] = [:]
        func cell(_ p: AtlasPoint) -> Cell {
            Cell(x: Int(floor(p.x / spacing)), y: Int(floor(p.y / spacing)), z: Int(floor(p.z / spacing)))
        }
        for (index, id) in ids.enumerated() {
            if let p = points[id] { buckets[cell(p), default: []].append(index) }
        }
        var displacements: [UUID: AtlasPoint] = [:]
        for (index, id) in ids.enumerated() {
            guard let a = points[id] else { continue }
            let origin = cell(a)
            for dz in (spatial ? -1...1 : 0...0) {
                for dy in -1...1 {
                    for dx in -1...1 {
                        let key = Cell(x: origin.x + dx, y: origin.y + dy, z: origin.z + dz)
                        for otherIndex in buckets[key] ?? [] where otherIndex > index {
                            let other = ids[otherIndex]
                            guard let b = points[other] else { continue }
                            var direction = AtlasPoint(x: b.x - a.x, y: b.y - a.y, z: b.z - a.z)
                            let distance = sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
                            guard distance < spacing else { continue }
                            maximumOverlap = max(maximumOverlap, spacing - distance)
                            if distance < 0.000001 {
                                // Deterministic non-zero direction for coincident inputs.
                                let angle = Double(index + otherIndex) * 2.399963
                                direction = AtlasPoint(x: cos(angle), y: sin(angle))
                            } else {
                                direction.x /= distance; direction.y /= distance; direction.z /= distance
                            }
                            let force = (spacing - distance) * 0.5
                            var da = displacements[id] ?? AtlasPoint(x: 0, y: 0)
                            var db = displacements[other] ?? AtlasPoint(x: 0, y: 0)
                            da.x -= direction.x * force; da.y -= direction.y * force; da.z -= direction.z * force
                            db.x += direction.x * force; db.y += direction.y * force; db.z += direction.z * force
                            displacements[id] = da; displacements[other] = db
                        }
                    }
                }
            }
        }
        for id in ids {
            guard var p = points[id], let d = displacements[id] else { continue }
            p.x += d.x; p.y += d.y; p.z += d.z; points[id] = p
        }
        return maximumOverlap
    }
}
