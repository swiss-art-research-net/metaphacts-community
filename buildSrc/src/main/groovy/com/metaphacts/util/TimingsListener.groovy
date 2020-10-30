package com.metaphacts.util;

import org.gradle.api.execution.TaskExecutionListener
import org.gradle.BuildListener
import org.gradle.BuildResult
import org.gradle.api.invocation.Gradle
import org.gradle.api.Task
import org.gradle.api.tasks.TaskState
import org.gradle.api.initialization.Settings
import java.util.concurrent.TimeUnit
import java.util.concurrent.ConcurrentHashMap

// Log timings per tasks
// see https://stackoverflow.com/questions/13031538/track-execution-time-per-task-in-gradle-script
// note: this implementation supports parallel task execution
class TimingsListener implements TaskExecutionListener, BuildListener {
    private Map<Task, Long> taskToStartTime = new ConcurrentHashMap<>();
    private timings = Collections.synchronizedList(new ArrayList<>());

    @Override
    void beforeExecute(Task task) {
        def startTime = System.nanoTime()
        taskToStartTime[task] = startTime
    }

    @Override
    void afterExecute(Task task, TaskState taskState) {
        def startTime = taskToStartTime[task]
        def ms = TimeUnit.MILLISECONDS.convert(System.nanoTime() - startTime, TimeUnit.NANOSECONDS)
        timings.add(new Tuple2<Integer, String>(ms, task.path))
        task.project.logger.info "${task.path} took ${ms}ms"
    }

    @Override
    void buildFinished(BuildResult result) {
        def tmp = timings.toSorted(new Comparator<Tuple2<Integer, String>>() {
            @Override
            int compare(Tuple2<Integer, String> o, Tuple2<Integer, String> t1) {
                return o.first - t1.first
            }
        })
        def threshold = 1000;
        boolean infoPrinted = false
        for (timing in tmp) {
            if (timing.first >= threshold) {
                if (!infoPrinted) {
                   println "Task timings (Threshold: " + threshold + " ms)"
                   infoPrinted = true;
                }
                printf "%ss  %s\n", timing.first / threshold, timing.second
            }
        }
    }
    
    @Override
    void buildStarted(Gradle gradle) {}

    @Override
    void projectsEvaluated(Gradle gradle) {}

    @Override
    void projectsLoaded(Gradle gradle) {}

    @Override
    void settingsEvaluated(Settings settings) {}
}