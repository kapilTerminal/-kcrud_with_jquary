$(document).ready(function () {
    // --- State ---
    let rooms = [];
    let students = [];
    let currentView = 'roomSection'; // 'roomSection' or 'studentSection'
    let pendingDelete = null; // { type, id }

    // --- Initialization ---
    init();

    function init() {
        // Theme Logic
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            $('#themeToggle i').removeClass('fa-moon').addClass('fa-sun');
        }

        // Load Data
        const storedRooms = localStorage.getItem('studygpt_rooms');
        const storedStudents = localStorage.getItem('studygpt_students');

        if (storedRooms) rooms = JSON.parse(storedRooms);
        if (storedStudents) students = JSON.parse(storedStudents);

        console.info(`SYSTEM: Loaded ${rooms.length} rooms and ${students.length} students`);

        refreshDashboard();
        renderMainList();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Tab Switching
        $('.tab-btn').on('click', function () {
            const target = $(this).data('target');
            currentView = target;

            $('.tab-btn').removeClass('active').css('border-bottom', 'none');
            $(this).addClass('active').css('border-bottom', '3px solid var(--secondary)');

            $('.management-section').hide();
            $(`#${target}`).fadeIn();

            $('#listTitle').text(target === 'roomSection' ? 'Room Inventory' : 'Student Registry');
            renderMainList();
        });

        // Room Form Submission
        $('#roomForm').on('submit', function (e) {
            e.preventDefault();
            const roomNo = $('#roomNoInput').val().trim();

            // Check for unique room number
            if (rooms.some(r => r.roomNo === roomNo)) {
                alert(`Room ${roomNo} already exists!`);
                return;
            }

            const newRoom = {
                id: Date.now(),
                roomNo: roomNo,
                capacity: parseInt($('#capacityInput').val()),
                type: $('#roomTypeInput').val(),
                occupants: [] // Array of student IDs
            };
            rooms.unshift(newRoom);
            saveData();
            refreshDashboard();
            renderMainList();
            this.reset();
        });

        // Student Form Submission
        $('#studentForm').on('submit', function (e) {
            e.preventDefault();
            const newStudent = {
                id: Date.now(),
                name: $('#studentNameInput').val(),
                course: $('#courseInput').val(),
                gender: $('#genderInput').val(),
                roomId: null // Not assigned initially
            };
            students.unshift(newStudent);
            saveData();
            refreshDashboard();
            renderMainList();
            this.reset();
        });

        // Search and Filter
        $('#searchInput, #filterType').on('input change', function () {
            renderMainList();
        });

        // Theme Toggle
        $('#themeToggle').on('click', function () {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            $(this).find('i').toggleClass('fa-moon fa-sun');
        });

        // Modal Close
        $('.close-modal, #confirmCancel').on('click', function () {
            $('.modal').fadeOut();
        });

        $(window).on('click', function (e) {
            if ($(e.target).is('.modal')) $('.modal').fadeOut();
        });

        // Confirm Action
        $('#confirmAction').on('click', function () {
            if (pendingDelete) {
                if (pendingDelete.type === 'room') {
                    rooms = rooms.filter(r => r.id !== pendingDelete.id);
                } else {
                    const student = students.find(s => s.id === pendingDelete.id);
                    if (student && student.roomId) {
                        unassignStudent(student.id, false); // silenty unassign
                    }
                    students = students.filter(s => s.id !== pendingDelete.id);
                }
                saveData();
                refreshDashboard();
                renderMainList();
                $('#confirmModal').fadeOut();
                pendingDelete = null;
            }
        });
    }

    // --- Core Logic ---

    function renderMainList() {
        const query = $('#searchInput').val().toLowerCase();
        const filter = $('#filterType').val();
        const $list = $('#mainList');
        $list.empty();

        if (currentView === 'roomSection') {
            let filteredRooms = rooms.filter(r => r.roomNo.toLowerCase().includes(query));

            // Apply Status Filter
            if (filter === 'available') filteredRooms = filteredRooms.filter(r => r.occupants.length < r.capacity);
            else if (filter === 'full') filteredRooms = filteredRooms.filter(r => r.occupants.length === r.capacity);
            else if (filter === 'partially') filteredRooms = filteredRooms.filter(r => r.occupants.length > 0 && r.occupants.length < r.capacity);

            if (filteredRooms.length === 0) {
                renderEmptyState($list, 'No rooms found.');
                return;
            }

            filteredRooms.forEach(room => {
                const status = getRoomStatus(room);
                const html = `
                    <div class="transaction-item card" style="border-left-color: ${status.color}">
                        <div class="icon-box" style="background: ${status.bg}; color: ${status.color}">
                            <i class="fa-solid fa-door-closed"></i>
                        </div>
                        <div class="details">
                            <h4>Room ${room.roomNo} <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted)">(${room.type})</span></h4>
                            <p>${room.occupants.length}/${room.capacity} Beds Occupied • ${status.label}</p>
                        </div>
                        <div class="actions">
                            <button class="btn-icon" title="Edit Room" onclick="openEditRoomModal(${room.id})"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="btn-icon" title="Assign Student" onclick="openAssignModal(${room.id})"><i class="fa-solid fa-user-plus"></i></button>
                            <button class="btn-icon delete" title="Delete Room" onclick="requestDelete('room', ${room.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
                $list.append(html);
            });
        } else {
            let filteredStudents = students.filter(s => s.name.toLowerCase().includes(query) || (s.id.toString()).includes(query));

            if (filteredStudents.length === 0) {
                renderEmptyState($list, 'No students found.');
                return;
            }

            filteredStudents.forEach(student => {
                const room = rooms.find(r => r.id === student.roomId);
                const html = `
                    <div class="transaction-item card" style="border-left-color: ${student.roomId ? 'var(--success)' : 'var(--text-muted)'}">
                        <div class="icon-box" style="background: ${student.roomId ? '#ECFDF5' : '#F3F4F6'}; color: ${student.roomId ? 'var(--success)' : 'var(--text-muted)'}">
                            <i class="fa-solid fa-user-graduate"></i>
                        </div>
                        <div class="details">
                            <h4>${student.name} <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted)">(${student.course})</span></h4>
                            <p>${student.gender} • ${student.roomId ? 'Room ' + room.roomNo : 'Unassigned'}</p>
                        </div>
                        <div class="actions">
                            <button class="btn-icon" title="Edit Student" onclick="openEditStudentModal(${student.id})"><i class="fa-solid fa-pen-to-square"></i></button>
                            ${student.roomId
                        ? `<button class="btn-icon" title="Unassign" onclick="unassignStudent(${student.id})"><i class="fa-solid fa-user-minus"></i></button>`
                        : `<button class="btn-icon" title="Assign to Room" onclick="openStudentAssignModal(${student.id})"><i class="fa-solid fa-link"></i></button>`
                    }
                            <button class="btn-icon delete" title="Delete Student" onclick="requestDelete('student', ${student.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
                $list.append(html);
            });
        }
    }

    function renderEmptyState($container, msg) {
        $container.html(`
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass"></i>
                <p>${msg}</p>
            </div>
        `);
    }

    function getRoomStatus(room) {
        if (room.occupants.length === 0) return { label: 'Available', color: 'var(--success)', bg: '#ECFDF5' };
        if (room.occupants.length < room.capacity) return { label: 'Partially Filled', color: 'var(--warning)', bg: '#FFFBEB' };
        return { label: 'Full', color: 'var(--danger)', bg: '#FEF2F2' };
    }

    function refreshDashboard() {
        const totalRooms = rooms.length;
        const totalStudents = students.length;
        const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);
        const occupiedBeds = students.filter(s => s.roomId !== null).length;
        const availableBeds = totalBeds - occupiedBeds;
        const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

        $('#totalRoomsStat').text(totalRooms);
        $('#totalStudentsStat').text(totalStudents);
        $('#totalBedsStat').text(totalBeds);
        $('#occupiedBedsStat').text(occupiedBeds);
        $('#availableBedsStat').text(availableBeds);
        $('#occupancyRate').text(`${occupancyRate}%`);

        $('#occupancyBar').css('width', `${occupancyRate}%`);

        const $status = $('#occupancyStatus');
        if (occupancyRate === 0) $status.text("Empty").css('color', 'var(--text-muted)');
        else if (occupancyRate < 70) $status.text("Good Capacity").css('color', 'var(--success)');
        else if (occupancyRate < 100) $status.text("Nearing Full").css('color', 'var(--warning)');
        else $status.text("House Full").css('color', 'var(--danger)');
    }

    function saveData() {
        localStorage.setItem('studygpt_rooms', JSON.stringify(rooms));
        localStorage.setItem('studygpt_students', JSON.stringify(students));
    }

    // --- Modal Actions ---

    window.requestDelete = function (type, id) {
        if (type === 'room') {
            const room = rooms.find(r => r.id === id);
            if (room.occupants.length > 0) {
                alert("Cannot delete room with active occupants. Please unassign them first.");
                return;
            }
            $('#confirmMessage').text(`Are you sure you want to delete Room ${room.roomNo}?`);
        } else {
            const student = students.find(s => s.id === id);
            $('#confirmMessage').text(`Are you sure you want to delete student ${student.name}?`);
        }
        pendingDelete = { type, id };
        $('#confirmModal').fadeIn().css('display', 'flex');
    };

    window.openAssignModal = function (roomId) {
        const room = rooms.find(r => r.id === roomId);
        if (room.occupants.length >= room.capacity) {
            alert("Room is already full!");
            return;
        }

        const availableStudents = students.filter(s => s.roomId === null);
        if (availableStudents.length === 0) {
            alert("No unassigned students available.");
            return;
        }

        $('#modalTitle').text(`Assign to Room ${room.roomNo}`);
        let options = availableStudents.map(s => `<option value="${s.id}">${s.name} (${s.course})</option>`).join('');

        $('#modalBody').html(`
            <div class="input-group">
                <label>Select Student</label>
                <select id="assignStudentId">
                    ${options}
                </select>
            </div>
            <button class="btn-save" onclick="processAssignment(${roomId})">Confirm Assignment</button>
        `);
        $('#mainModal').fadeIn().css('display', 'flex');
    };

    window.openEditRoomModal = function (roomId) {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;

        $('#modalTitle').text(`Edit Room ${room.roomNo}`);
        $('#modalBody').html(`
            <div class="form-grid" style="flex-direction: column; align-items: stretch;">
                <div class="input-group">
                    <label>Room Number</label>
                    <input type="text" id="editRoomNo" value="${room.roomNo}" required>
                </div>
                <div class="input-group">
                    <label>Capacity</label>
                    <input type="number" id="editCapacity" value="${room.capacity}" min="${room.occupants.length}" max="10" required>
                </div>
                <div class="input-group">
                    <label>Room Type</label>
                    <select id="editRoomType" required>
                        <option value="Single" ${room.type === 'Single' ? 'selected' : ''}>Single</option>
                        <option value="Double" ${room.type === 'Double' ? 'selected' : ''}>Double</option>
                        <option value="Triple" ${room.type === 'Triple' ? 'selected' : ''}>Triple</option>
                    </select>
                </div>
                <button class="btn-save" onclick="saveEditRoom(${roomId})">Update Room</button>
            </div>
        `);
        $('#mainModal').fadeIn().css('display', 'flex');
    };

    window.saveEditRoom = function (roomId) {
        const room = rooms.find(r => r.id === roomId);
        const newRoomNo = $('#editRoomNo').val().trim();

        // Check for unique room number (excluding itself)
        if (rooms.some(r => r.roomNo === newRoomNo && r.id !== roomId)) {
            alert(`Room ${newRoomNo} already exists!`);
            return;
        }

        if (room) {
            room.roomNo = newRoomNo;
            room.capacity = parseInt($('#editCapacity').val());
            room.type = $('#editRoomType').val();

            saveData();
            refreshDashboard();
            renderMainList();
            $('#mainModal').fadeOut();
        }
    };

    window.openEditStudentModal = function (studentId) {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        $('#modalTitle').text(`Edit ${student.name}`);
        $('#modalBody').html(`
            <div class="form-grid" style="flex-direction: column; align-items: stretch;">
                <div class="input-group">
                    <label>Full Name</label>
                    <input type="text" id="editStudentName" value="${student.name}" required>
                </div>
                <div class="input-group">
                    <label>Course</label>
                    <input type="text" id="editCourse" value="${student.course}" required>
                </div>
                <div class="input-group">
                    <label>Gender</label>
                    <select id="editGender" required>
                        <option value="Male" ${student.gender === 'Male' ? 'selected' : ''}>Male</option>
                        <option value="Female" ${student.gender === 'Female' ? 'selected' : ''}>Female</option>
                        <option value="Other" ${student.gender === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <button class="btn-save" onclick="saveEditStudent(${studentId})">Update Student</button>
            </div>
        `);
        $('#mainModal').fadeIn().css('display', 'flex');
    };

    window.saveEditStudent = function (studentId) {
        const student = students.find(s => s.id === studentId);
        if (student) {
            student.name = $('#editStudentName').val();
            student.course = $('#editCourse').val();
            student.gender = $('#editGender').val();

            saveData();
            refreshDashboard();
            renderMainList();
            $('#mainModal').fadeOut();
        }
    };

    window.openStudentAssignModal = function (studentId) {
        const student = students.find(s => s.id === studentId);
        const availableRooms = rooms.filter(r => r.occupants.length < r.capacity);

        if (availableRooms.length === 0) {
            alert("No available rooms found!");
            return;
        }

        $('#modalTitle').text(`Assign ${student.name}`);
        let options = availableRooms.map(r => `<option value="${r.id}">Room ${r.roomNo} (${r.occupants.length}/${r.capacity})</option>`).join('');

        $('#modalBody').html(`
            <div class="input-group">
                <label>Select Room</label>
                <select id="assignRoomId">
                    ${options}
                </select>
            </div>
            <button class="btn-save" onclick="processStudentAssignment(${studentId})">Confirm Assignment</button>
        `);
        $('#mainModal').fadeIn().css('display', 'flex');
    };

    window.processAssignment = function (roomId) {
        const studentId = parseInt($('#assignStudentId').val());
        assignStudentToRoom(studentId, roomId);
        $('#mainModal').fadeOut();
    };

    window.processStudentAssignment = function (studentId) {
        const roomId = parseInt($('#assignRoomId').val());
        assignStudentToRoom(studentId, roomId);
        $('#mainModal').fadeOut();
    };

    function assignStudentToRoom(studentId, roomId) {
        const room = rooms.find(r => r.id === roomId);
        const student = students.find(s => s.id === studentId);

        if (room && student && room.occupants.length < room.capacity) {
            student.roomId = roomId;
            room.occupants.push(studentId);
            saveData();
            refreshDashboard();
            renderMainList();
        }
    }

    window.unassignStudent = function (studentId, silent = false) {
        if (!silent && !confirm("Unassign student from this room?")) return;

        const student = students.find(s => s.id === studentId);
        if (student && student.roomId) {
            const room = rooms.find(r => r.id === student.roomId);
            if (room) {
                room.occupants = room.occupants.filter(id => id !== studentId);
            }
            student.roomId = null;
            saveData();
            refreshDashboard();
            renderMainList();
        }
    }

    // --- Export ---
    window.exportToCSV = function () {
        if (rooms.length === 0 && students.length === 0) {
            alert("No data to export!");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Type,ID,Name/No,Details,Status/Gender\n";

        rooms.forEach(r => {
            csvContent += `Room,${r.id},${r.roomNo},${r.type},${r.occupants.length}/${r.capacity} Beds\n`;
        });
        students.forEach(s => {
            const room = rooms.find(r => r.id === s.roomId);
            csvContent += `Student,${s.id},${s.name},${s.course},${room ? 'Room ' + room.roomNo : 'Unassigned'}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "studygpt_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
